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

@Injectable()
export class SetupService {
    private readonly logger = new Logger(SetupService.name);
    private readonly setupStatusPath = path.join(process.cwd(), '..', 'setup-status.json');
    private readonly envPath = path.join(process.cwd(), '.env');

    constructor(private readonly serverSettingsService: ServerSettingsService) { }

    /**
     * Check if setup has been completed
     */
    async isSetupCompleted(): Promise<boolean> {
        try {
            const status = await this.getSetupStatus();
            return status.completed;
        } catch {
            return false;
        }
    }

    /**
     * Get current setup status
     */
    async getSetupStatus(): Promise<SetupStatus> {
        try {
            const data = await fs.readFile(this.setupStatusPath, 'utf-8');
            return JSON.parse(data);
        } catch {
            return {
                completed: false,
            };
        }
    }

    /**
     * Complete setup with provided configuration
     */
    async completeSetup(config: SetupConfig): Promise<SetupCompleteResponse> {
        try {
            // Check if setup is already completed
            const isCompleted = await this.isSetupCompleted();
            if (isCompleted) {
                return {
                    success: false,
                    message: 'Setup has already been completed',
                };
            }

            // Validate configuration
            const validation = this.validateConfig(config);
            if (!validation.valid) {
                return {
                    success: false,
                    message: 'Invalid configuration',
                    errors: validation.errors,
                };
            }

            // Generate session secret if not provided
            if (!config.sessionSecret) {
                config.sessionSecret = randomBytes(32).toString('hex');
            }

            // Set default values
            config.rootPath = config.rootPath || '/opt/clearpanel/data';
            config.domainsRoot = config.domainsRoot || path.join(os.homedir(), 'clearpanel-domains');
            config.port = config.port || 3334;
            config.maxFileSize = config.maxFileSize || 104857600; // 100MB

            // Create necessary directories
            await this.createDirectories(config);

            // Generate .env file
            await this.generateEnvFile(config);

            // Update server settings
            await this.updateServerSettings(config);

            // Mark setup as completed
            await this.markSetupCompleted();

            this.logger.log('Setup completed successfully');

            return {
                success: true,
                message: 'Setup completed successfully',
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Setup failed: ${message}`, error);
            return {
                success: false,
                message: `Setup failed: ${message}`,
            };
        }
    }

    /**
     * Validate configuration
     */
    validateConfig(config: SetupConfig): SetupValidationResult {
        const errors: string[] = [];

        // Validate admin username
        if (!config.adminUsername) {
            errors.push('Admin username is required');
        } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(config.adminUsername)) {
            errors.push('Admin username must be 3-20 characters (alphanumeric and underscore only)');
        }

        // Validate admin password
        if (!config.adminPassword) {
            errors.push('Admin password is required');
        } else if (config.adminPassword.length < 8) {
            errors.push('Admin password must be at least 8 characters');
        }

        // Validate server IP
        if (!config.serverIp) {
            errors.push('Server IP is required');
        } else if (!this.isValidIPv4(config.serverIp)) {
            errors.push('Invalid IPv4 address format');
        }

        // Validate primary domain (optional)
        if (config.primaryDomain && !this.isValidDomain(config.primaryDomain)) {
            errors.push('Invalid domain name format');
        }

        // Validate nameservers (optional)
        if (config.nameservers && config.nameservers.length > 0) {
            for (const ns of config.nameservers) {
                if (!this.isValidDomain(ns)) {
                    errors.push(`Invalid nameserver format: ${ns}`);
                }
            }
        }

        // Validate port
        if (config.port !== undefined) {
            if (config.port < 1 || config.port > 65535) {
                errors.push('Port must be between 1 and 65535');
            }
        }

        // Validate max file size
        if (config.maxFileSize !== undefined) {
            if (config.maxFileSize < 1024 || config.maxFileSize > 1073741824) {
                errors.push('Max file size must be between 1KB and 1GB');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Auto-detect server IP address
     */
    async detectServerIp(): Promise<string | null> {
        const interfaces = os.networkInterfaces();
        for (const value of Object.values(interfaces)) {
            if (!value) continue;
            for (const details of value) {
                if (details.family === 'IPv4' && !details.internal && details.address) {
                    return details.address;
                }
            }
        }
        return null;
    }

    /**
     * Create necessary directories
     */
    private async createDirectories(config: SetupConfig): Promise<void> {
        const rootPath = config.rootPath!;

        // Standard cPanel-like directory structure
        const directories = [
            rootPath,
            path.join(rootPath, 'public_html'),          // Main domain web root
            path.join(rootPath, 'mail'),                  // Email storage
            path.join(rootPath, 'logs'),                  // Server logs
            path.join(rootPath, 'tmp'),                   // Temporary files
            path.join(rootPath, 'etc'),                   // Config files
            path.join(rootPath, 'ssl', 'certs'),          // SSL certificates
            path.join(rootPath, 'ssl', 'keys'),           // SSL private keys
            path.join(rootPath, 'ssl', 'csrs'),           // Certificate signing requests
            path.join(rootPath, 'cgi-bin'),               // CGI scripts
            config.domainsRoot!,
        ];

        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
                this.logger.log(`Created directory: ${dir}`);
            } catch (error) {
                this.logger.warn(`Failed to create directory ${dir}:`, error);
            }
        }

        // Create README files to explain directory purposes
        await this.createDirectoryReadmes(rootPath);
    }

    /**
     * Create README files in standard directories
     */
    private async createDirectoryReadmes(rootPath: string): Promise<void> {
        const readmes: Record<string, string> = {
            'public_html/README.txt': 'Main website files - Your domains are served from here.\nThis directory is managed by clearPanel.',
            'mail/README.txt': 'Email data storage for all mailboxes.\nThis directory is managed by clearPanel.',
            'logs/README.txt': 'Server access and error logs.\nThis directory is managed by clearPanel.',
            'tmp/README.txt': 'Temporary files (auto-cleaned periodically).\nThis directory is managed by clearPanel.',
            'etc/README.txt': 'Configuration files.\nThis directory is managed by clearPanel.',
            'ssl/README.txt': 'SSL certificates, keys, and certificate signing requests.\nThis directory is managed by clearPanel.',
            'cgi-bin/README.txt': 'CGI scripts and executables.\nThis directory is managed by clearPanel.',
        };

        for (const [file, content] of Object.entries(readmes)) {
            try {
                const filePath = path.join(rootPath, file);
                await fs.writeFile(filePath, content);
            } catch (error) {
                // Non-critical, just log
                this.logger.debug(`Could not create README: ${file}`);
            }
        }
    }

    /**
     * Generate .env file
     */
    private async generateEnvFile(config: SetupConfig): Promise<void> {
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
ALLOWED_EXTENSIONS=*
MAX_FILE_SIZE=${config.maxFileSize}

DOMAINS_ROOT=${config.domainsRoot}
`;

        await fs.writeFile(this.envPath, envContent, 'utf-8');
        await fs.chmod(this.envPath, 0o600); // Owner read/write only

        this.logger.log('Generated .env file');
    }

    /**
     * Update server settings
     */
    private async updateServerSettings(config: SetupConfig): Promise<void> {
        await this.serverSettingsService.updateSettings({
            primaryDomain: config.primaryDomain,
            serverIp: config.serverIp,
            nameservers: config.nameservers || [],
        });

        this.logger.log('Updated server settings');
    }

    /**
     * Mark setup as completed
     */
    private async markSetupCompleted(): Promise<void> {
        const status: SetupStatus = {
            completed: true,
            completedAt: new Date().toISOString(),
            version: '1.0.0',
        };

        await fs.writeFile(this.setupStatusPath, JSON.stringify(status, null, 2), 'utf-8');
        this.logger.log('Marked setup as completed');
    }

    /**
     * Validate IPv4 address format
     */
    private isValidIPv4(ip: string): boolean {
        const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(ip);
    }

    /**
     * Validate domain name format
     */
    private isValidDomain(domain: string): boolean {
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
        return domainRegex.test(domain);
    }
}
