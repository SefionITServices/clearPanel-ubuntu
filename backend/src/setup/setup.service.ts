import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomBytes } from 'crypto';
import {
    SetupConfig,
    SetupStatus,
    SetupValidationResult,
    SetupCompleteResponse,
} from './setup.model';
import { ServerSettingsService } from '../server/server-settings.service';
import { DnsService } from '../dns/dns.service';
import { DnsServerService } from '../dns-server/dns-server.service';
import { WebServerService } from '../webserver/webserver.service';
import { DomainsService } from '../domains/domains.service';

@Injectable()
export class SetupService {
    private readonly logger = new Logger(SetupService.name);
    private readonly envPath = path.join(process.cwd(), '.env');

    // Bootstrap paths — these stay in /opt/clearpanel/data/ (pre-setup, no username yet)
    private get setupStatusPath(): string {
        return path.join(
            process.env.DATA_DIR || path.join(process.cwd(), '..', 'data'),
            'setup-status.json',
        );
    }

    constructor(
        private readonly serverSettingsService: ServerSettingsService,
        private readonly dnsService: DnsService,
        private readonly dnsServerService: DnsServerService,
        private readonly webServerService: WebServerService,
        private readonly domainsService: DomainsService,
    ) { }

    async isSetupCompleted(): Promise<boolean> {
        try {
            const status = await this.getSetupStatus();
            return status.completed;
        } catch {
            return false;
        }
    }

    async getSetupStatus(): Promise<SetupStatus> {
        try {
            const data = await fs.readFile(this.setupStatusPath, 'utf-8');
            return JSON.parse(data);
        } catch {
            return { completed: false };
        }
    }

    async completeSetup(config: SetupConfig): Promise<SetupCompleteResponse> {
        try {
            const isCompleted = await this.isSetupCompleted();
            if (isCompleted) {
                return { success: false, message: 'Setup has already been completed' };
            }

            const validation = this.validateConfig(config);
            if (!validation.valid) {
                return { success: false, message: 'Invalid configuration', errors: validation.errors };
            }

            // Generate session secret if not provided
            if (!config.sessionSecret) {
                config.sessionSecret = randomBytes(32).toString('hex');
            }

            // Set defaults
            config.rootPath = config.rootPath || '/home';
            config.port = config.port || 3334;
            config.maxFileSize = config.maxFileSize || 104857600;

            // 1. Create user home directory with cPanel-like structure
            const userHome = path.join(config.rootPath, config.adminUsername);
            await this.createUserHome(userHome);

            // 1b. Create panel data directory inside user home
            //     All JSON data files (domains, dns, settings, mail, etc.) live here
            const userDataDir = path.join(userHome, 'etc', 'clearpanel');
            await fs.mkdir(userDataDir, { recursive: true });
            // Set DATA_DIR in process so all services use the new path immediately
            process.env.DATA_DIR = userDataDir;
            this.logger.log(`Data directory set to: ${userDataDir}`);

            // 2. Generate .env file (includes DATA_DIR pointing to user home)
            await this.generateEnvFile(config, userDataDir);

            // 3. Update server settings (IP, nameservers, primary domain)
            await this.updateServerSettings(config);

            // 4. If primary domain provided, provision it fully (and add it to domain list)
            let primaryDomainConfigured = false;
            const provisioningResults: string[] = [];
            if (config.primaryDomain) {
                const publicHtml = path.join(userHome, 'public_html');
                await this.createDefaultIndexHtml(publicHtml, config.primaryDomain);

                try {
                    const domainResult = await this.provisionPrimaryDomain(config);
                    primaryDomainConfigured = true;
                    provisioningResults.push(
                        ...domainResult.logs.map((log) =>
                            `${log.success ? 'OK' : 'WARN'}: ${log.task} - ${log.message}`,
                        ),
                    );
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    this.logger.error(`Primary domain provisioning partially failed: ${msg}`);
                    provisioningResults.push(`Provisioning warning: ${msg}`);
                    // Don't fail entire setup — domain can be re-added via panel
                    primaryDomainConfigured = true;
                }
            }

            // 5. Mark setup as completed
            await this.markSetupCompleted(config.adminUsername, config.primaryDomain);

            this.logger.log('Setup completed successfully');

            return {
                success: true,
                message: 'Setup completed successfully. The server will restart automatically.',
                details: {
                    userHome,
                    primaryDomainConfigured,
                    nameserversConfigured: config.nameservers || [],
                    provisioningResults,
                    loginUrl: config.primaryDomain
                        ? `http://${config.primaryDomain}`
                        : `http://${config.serverIp}`,
                },
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Setup failed: ${message}`, error);
            return { success: false, message: `Setup failed: ${message}` };
        }
    }

    validateConfig(config: SetupConfig): SetupValidationResult {
        const errors: string[] = [];

        if (!config.adminUsername) {
            errors.push('Admin username is required');
        } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(config.adminUsername)) {
            errors.push('Username must be 3-20 characters (alphanumeric and underscore only)');
        }

        if (!config.adminPassword) {
            errors.push('Admin password is required');
        } else if (config.adminPassword.length < 8) {
            errors.push('Admin password must be at least 8 characters');
        }

        if (!config.serverIp) {
            errors.push('Server IP is required');
        } else if (!this.isValidIPv4(config.serverIp)) {
            errors.push('Invalid IPv4 address format');
        }

        if (config.primaryDomain && !this.isValidDomain(config.primaryDomain)) {
            errors.push('Invalid domain name format');
        }

        if (config.nameservers && config.nameservers.length > 0) {
            for (const ns of config.nameservers) {
                if (!this.isValidDomain(ns)) {
                    errors.push(`Invalid nameserver format: ${ns}`);
                }
            }
        }

        if (config.port !== undefined && (config.port < 1 || config.port > 65535)) {
            errors.push('Port must be between 1 and 65535');
        }

        return { valid: errors.length === 0, errors };
    }

    async detectServerIp(): Promise<string | null> {
        // Method 1: Try shell commands (curl / wget / dig)
        try {
            const { execSync } = require('child_process');
            const commands = [
                'curl -s --max-time 5 ifconfig.me 2>/dev/null',
                'curl -s --max-time 5 icanhazip.com 2>/dev/null',
                'curl -s --max-time 5 api.ipify.org 2>/dev/null',
                'wget -qO- --timeout=5 ifconfig.me 2>/dev/null',
                'wget -qO- --timeout=5 icanhazip.com 2>/dev/null',
                'dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null',
                "hostname -I 2>/dev/null | awk '{print $1}'",
            ];
            for (const cmd of commands) {
                try {
                    const result = execSync(cmd, {
                        encoding: 'utf-8',
                        timeout: 8000,
                        stdio: ['pipe', 'pipe', 'pipe'],
                    }).trim();
                    if (result && this.isValidIPv4(result)) {
                        return result;
                    }
                } catch {
                    // Try next command
                }
            }
        } catch {
            // Fall through to native detection
        }

        // Method 2: Node.js native HTTPS (no curl/wget needed)
        try {
            const ip = await this.fetchIpNative('https://api.ipify.org');
            if (ip && this.isValidIPv4(ip)) return ip;
        } catch {
            // Fall through
        }
        try {
            const ip = await this.fetchIpNative('https://icanhazip.com');
            if (ip && this.isValidIPv4(ip)) return ip;
        } catch {
            // Fall through
        }

        // Method 3: Local network interfaces
        // Note: Node.js 18+ returns family as number (4/6) instead of string ('IPv4'/'IPv6')
        const interfaces = os.networkInterfaces();
        for (const value of Object.values(interfaces)) {
            if (!value) continue;
            for (const details of value) {
                const isIPv4 = details.family === 'IPv4' || (details.family as unknown) === 4;
                if (isIPv4 && !details.internal && details.address) {
                    return details.address;
                }
            }
        }
        return null;
    }

    /** Fetch IP from an HTTPS endpoint using native Node.js (no curl/wget) */
    private fetchIpNative(url: string): Promise<string> {
        const https = require('https');
        return new Promise((resolve, reject) => {
            const req = https.get(url, { timeout: 5000 }, (res: any) => {
                let data = '';
                res.on('data', (chunk: string) => (data += chunk));
                res.on('end', () => resolve(data.trim()));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });
    }

    /**
     * Create cPanel-like user home directory structure
     */
    private async createUserHome(userHome: string): Promise<void> {
        const dirs = [
            '',                // user home root
            'public_html',     // main website files
            'mail',            // email storage
            'logs',            // server logs
            'tmp',             // temporary files
            'etc',             // config files
            'ssl/certs',       // SSL certificates
            'ssl/keys',        // SSL private keys
            'ssl/csrs',        // CSRs
            'cgi-bin',         // CGI scripts
            '.ssh',            // SSH keys
            '.trash',          // recycle bin
        ];

        for (const dir of dirs) {
            const fullPath = path.join(userHome, dir);
            try {
                await fs.mkdir(fullPath, { recursive: true });
            } catch (error) {
                this.logger.error(`Failed to create ${fullPath}:`, error);
                // Fail fast on home root and public_html — these are critical
                if (dir === '' || dir === 'public_html') {
                    throw new Error(
                        `Cannot create ${fullPath}. Ensure the clearpanel user has write permission to ${path.dirname(userHome)}.`,
                    );
                }
            }
        }

        // Secure .ssh directory
        try {
            await fs.chmod(path.join(userHome, '.ssh'), 0o700);
        } catch { }

        this.logger.log(`Created user home directory: ${userHome}`);
    }

    /**
     * Create default index.html for the primary domain
     */
    private async createDefaultIndexHtml(publicHtml: string, domain: string): Promise<void> {
        const indexPath = path.join(publicHtml, 'index.html');
        try {
            await fs.access(indexPath);
            return; // Already exists
        } catch { }

        // Ensure the directory exists before writing
        await fs.mkdir(publicHtml, { recursive: true });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${domain} - Hosted on clearPanel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 48px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 540px;
            width: 90%;
        }
        .emoji { font-size: 3.5em; margin-bottom: 16px; }
        h1 { color: #1a1a2e; font-size: 1.8em; margin-bottom: 12px; }
        .domain { color: #667eea; font-weight: 700; }
        p { color: #666; line-height: 1.7; margin-bottom: 8px; }
        .badge {
            display: inline-block;
            margin-top: 24px;
            padding: 8px 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">🚀</div>
        <h1>Welcome to <span class="domain">${domain}</span></h1>
        <p>This website is successfully configured and ready to go.</p>
        <p>Upload your website files to <strong>public_html</strong> using the File Manager.</p>
        <div class="badge">Hosted on clearPanel</div>
    </div>
</body>
</html>`;

        await fs.writeFile(indexPath, html, 'utf-8');
        this.logger.log(`Created default index.html for ${domain}`);
    }

    /**
     * Provision the primary domain: DNS zone in dns.json, BIND9 zone file, Nginx vhost
     */
    private async provisionPrimaryDomain(config: SetupConfig) {
        const domain = config.primaryDomain!;
        this.logger.log(`Provisioning primary domain via DomainsService: ${domain}`);
        return this.domainsService.addDomain(
            config.adminUsername,
            domain,
            undefined,
            config.nameservers,
            undefined,
        );
    }

    private async generateEnvFile(config: SetupConfig, dataDir: string): Promise<void> {
        const timestamp = new Date().toISOString();
        const envContent = `# Generated by clearPanel Setup Wizard
# Date: ${timestamp}

NODE_ENV=production
PORT=${config.port}

SESSION_SECRET=${config.sessionSecret}

ADMIN_USERNAME=${config.adminUsername}
ADMIN_PASSWORD=${config.adminPassword}

SERVER_IP=${config.serverIp}

ROOT_PATH=${config.rootPath}
DATA_DIR=${dataDir}
ALLOWED_EXTENSIONS=*
MAX_FILE_SIZE=${config.maxFileSize}
`;

        await fs.writeFile(this.envPath, envContent, 'utf-8');
        try { await fs.chmod(this.envPath, 0o600); } catch { }
        this.logger.log('Generated .env file');
    }

    private async updateServerSettings(config: SetupConfig): Promise<void> {
        await this.serverSettingsService.updateSettings({
            primaryDomain: config.primaryDomain,
            serverIp: config.serverIp,
            nameservers: config.nameservers || [],
        });
        this.logger.log('Updated server settings');
    }

    private async markSetupCompleted(adminUsername: string, primaryDomain?: string): Promise<void> {
        const status: SetupStatus = {
            completed: true,
            completedAt: new Date().toISOString(),
            version: '1.0.0',
            adminUsername,
            primaryDomain,
        };
        await fs.mkdir(path.dirname(this.setupStatusPath), { recursive: true });
        await fs.writeFile(this.setupStatusPath, JSON.stringify(status, null, 2), 'utf-8');
    }

    private isValidIPv4(ip: string): boolean {
        return /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ip);
    }

    private isValidDomain(domain: string): boolean {
        return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i.test(domain);
    }
}
