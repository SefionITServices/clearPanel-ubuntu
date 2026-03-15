import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface SslCertificate {
  domain: string;
  status: 'active' | 'expired' | 'none';
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  autoRenew: boolean;
}

export interface SslInstallResult {
  success: boolean;
  message: string;
  certificate?: SslCertificate;
  logs: string[];
}

@Injectable()
export class SslService {
  private readonly logger = new Logger(SslService.name);

  /**
   * Check if certbot is installed
   */
  async isCertbotInstalled(): Promise<boolean> {
    try {
      await execAsync('which certbot');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Install certbot + nginx plugin
   */
  async installCertbot(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('Installing certbot...');
      await execAsync('sudo -n apt-get update -qq');
      await execAsync('sudo -n apt-get install -y certbot python3-certbot-nginx');
      return { success: true, message: 'Certbot installed successfully' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to install certbot: ${msg}`);
      return { success: false, message: `Failed to install certbot: ${msg}` };
    }
  }

  /**
   * Pre-flight DNS check: resolve domain and compare to server IP
   */
  private async checkDnsResolution(domain: string): Promise<{ ok: boolean; resolvedIp?: string; serverIp?: string; message?: string }> {
    try {
      // Get server's public IP
      let serverIp = '';
      try {
        const { stdout } = await execAsync('curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me', { timeout: 10000 });
        serverIp = stdout.trim();
      } catch {
        // fallback: try hostname -I
        try {
          const { stdout } = await execAsync('hostname -I | awk \'{print $1}\'', { timeout: 5000 });
          serverIp = stdout.trim();
        } catch {}
      }

      // Resolve domain
      let resolvedIp = '';
      try {
        const { stdout } = await execAsync(`dig +short A ${domain} @8.8.8.8 | head -1`, { timeout: 10000 });
        resolvedIp = stdout.trim();
      } catch {
        try {
          const { stdout } = await execAsync(`host ${domain} 2>/dev/null | grep 'has address' | head -1 | awk '{print $NF}'`, { timeout: 10000 });
          resolvedIp = stdout.trim();
        } catch {}
      }

      if (!resolvedIp) {
        return { ok: false, serverIp, message: `Domain "${domain}" does not resolve to any IP address. Make sure DNS A record is set.` };
      }

      if (serverIp && resolvedIp !== serverIp) {
        return {
          ok: false,
          resolvedIp,
          serverIp,
          message: `Domain "${domain}" resolves to ${resolvedIp} but this server's IP is ${serverIp}. Update the DNS A record to point to ${serverIp}.`,
        };
      }

      return { ok: true, resolvedIp, serverIp };
    } catch {
      // Don't block SSL install if pre-flight check itself fails
      return { ok: true, message: 'DNS pre-flight check skipped' };
    }
  }

  /**
   * Try to read the latest certbot log for detailed error info
   */
  private async readCertbotLog(): Promise<string> {
    try {
      const { stdout } = await execAsync('sudo -n tail -50 /var/log/letsencrypt/letsencrypt.log 2>/dev/null', { timeout: 5000 });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  /**
   * Request and install an SSL certificate for a domain using Let's Encrypt
   */
  async installCertificate(
    domain: string,
    email: string,
    includeWww: boolean = true,
  ): Promise<SslInstallResult> {
    const logs: string[] = [];

    // Check certbot
    const installed = await this.isCertbotInstalled();
    if (!installed) {
      logs.push('Certbot not found, installing...');
      const installResult = await this.installCertbot();
      if (!installResult.success) {
        return { success: false, message: installResult.message, logs };
      }
      logs.push('Certbot installed successfully');
    }

    // Verify nginx is running
    try {
      const { stdout } = await execAsync('sudo -n systemctl is-active nginx', { timeout: 5000 });
      if (stdout.trim() !== 'active') {
        logs.push('Warning: Nginx is not running, attempting to start...');
        await execAsync('sudo -n systemctl start nginx', { timeout: 10000 });
        logs.push('Nginx started');
      }
    } catch {
      logs.push('Warning: Could not verify nginx status');
    }

    // Verify nginx vhost exists for the domain
    const vhostExists = await fs
      .access(`/etc/nginx/sites-available/${domain}`)
      .then(() => true)
      .catch(() => false);

    if (!vhostExists) {
      return {
        success: false,
        message: `No Nginx virtual host found for ${domain}. Add the domain first before installing SSL.`,
        logs,
      };
    }

    // Pre-flight DNS check
    logs.push('Checking DNS resolution...');
    const dnsCheck = await this.checkDnsResolution(domain);
    if (!dnsCheck.ok) {
      logs.push(`DNS check failed: ${dnsCheck.message}`);
      return {
        success: false,
        message: dnsCheck.message || `DNS check failed for ${domain}`,
        logs,
      };
    }
    logs.push(`DNS OK: ${domain} resolves to ${dnsCheck.resolvedIp}${dnsCheck.serverIp ? ` (server IP: ${dnsCheck.serverIp})` : ''}`);

    if (includeWww) {
      const wwwCheck = await this.checkDnsResolution(`www.${domain}`);
      if (!wwwCheck.ok) {
        logs.push(`www DNS check failed: ${wwwCheck.message}`);
        logs.push('Falling back to installing without www...');
        includeWww = false;
      } else {
        logs.push(`DNS OK: www.${domain} resolves to ${wwwCheck.resolvedIp}`);
      }
    }

    // Check port 80 is accessible
    try {
      await execAsync(`curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://${domain}/.well-known/acme-challenge/test 2>/dev/null || true`, { timeout: 10000 });
    } catch {
      logs.push('Warning: Could not verify port 80 accessibility');
    }

    // Build certbot command
    const domains = includeWww ? `-d ${domain} -d www.${domain}` : `-d ${domain}`;
    const cmd = `sudo -n certbot --nginx ${domains} --non-interactive --agree-tos --email ${email} --redirect -v`;

    logs.push(`Running: certbot --nginx ${domains}`);
    this.logger.log(`Installing SSL for ${domain} (email: ${email})`);

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 180000 });
      if (stdout) logs.push(stdout.trim());
      if (stderr) {
        // Filter out debug noise, keep useful lines
        const usefulStderr = stderr.split('\n').filter(l => !l.startsWith('Saving debug log')).join('\n').trim();
        if (usefulStderr) logs.push(usefulStderr);
      }

      // Verify certificate was installed
      const cert = await this.getCertificateInfo(domain);

      return {
        success: true,
        message: `SSL certificate installed for ${domain}`,
        certificate: cert,
        logs,
      };
    } catch (error: any) {
      const errStdout = (error.stdout || '').trim();
      const errStderr = (error.stderr || '').trim();
      const errMsg = error.message || String(error);

      if (errStdout) logs.push(errStdout);
      if (errStderr) logs.push(errStderr);

      // Try reading the certbot log for more details
      const certbotLog = await this.readCertbotLog();
      if (certbotLog) {
        // Extract the most relevant lines (challenge failures, errors)
        const relevantLines = certbotLog.split('\n').filter(l =>
          /error|fail|challenge|unauthorized|invalid|detail|hint|problem|refused|timeout|resolv/i.test(l)
        ).slice(-15).join('\n');
        if (relevantLines) {
          logs.push('--- Certbot log details ---');
          logs.push(relevantLines);
        }
      }

      this.logger.error(`SSL installation failed for ${domain}: ${errMsg}`);

      // Provide helpful error messages
      const allOutput = [errStdout, errStderr, errMsg, certbotLog].join(' ');
      let message = `SSL installation failed for ${domain}`;
      if (allOutput.includes('DNS problem') || allOutput.includes('NXDOMAIN')) {
        message += '. DNS is not pointing to this server. Ensure A records for the domain point to your server IP.';
      } else if (allOutput.includes('too many certificates') || allOutput.includes('rate limit')) {
        message += '. Let\'s Encrypt rate limit reached. Try again later or use a staging certificate.';
      } else if (allOutput.includes('Connection refused') || allOutput.includes('Timeout')) {
        message += '. Could not connect to the server on port 80. Ensure port 80 is open in your firewall (ufw allow 80).';
      } else if (allOutput.includes('unauthorized') || allOutput.includes('challenge')) {
        message += '. ACME challenge failed. Ensure: (1) DNS A record points to this server, (2) Port 80 is open, (3) Nginx is running and serving the domain.';
      } else if (allOutput.includes('Could not bind') || allOutput.includes('Address already in use')) {
        message += '. Port 80 is in use by another process. Stop any conflicting services.';
      } else if (allOutput.includes('sudo') || allOutput.includes('password') || allOutput.includes('terminal')) {
        message += '. Permission denied. The backend must be run as root or with passwordless sudo to perform this action. Check sudoers configuration.';
      }

      return { success: false, message, logs };
    }
  }

  /**
   * Get certificate info for a domain
   */
  async getCertificateInfo(domain: string): Promise<SslCertificate> {
    const none: SslCertificate = {
      domain,
      status: 'none',
      autoRenew: false,
    };

    try {
      const { stdout } = await execAsync(
        `sudo -n certbot certificates --domain ${domain} 2>/dev/null`,
        { timeout: 15000 },
      );

      if (!stdout || stdout.includes('No certificates found')) {
        return none;
      }

      const expiryMatch = stdout.match(/Expiry Date:\s*(\S+ \S+)/);
      const validFromMatch = stdout.match(/Certificate Path:\s*(\S+)/);
      const issuerLine = stdout.includes('Let\'s Encrypt') ? "Let's Encrypt" : 'Unknown';

      let validTo: string | undefined;
      let daysRemaining: number | undefined;
      let status: 'active' | 'expired' = 'active';

      if (expiryMatch) {
        validTo = expiryMatch[1];
        const expiryDate = new Date(validTo);
        const now = new Date();
        daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          status = 'expired';
          daysRemaining = 0;
        }
      }

      return {
        domain,
        status,
        issuer: issuerLine,
        validTo,
        daysRemaining,
        autoRenew: true,
      };
    } catch {
      // Try checking certificate file directly
      try {
        const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
        await fs.access(certPath);
        const { stdout } = await execAsync(
          `openssl x509 -in ${certPath} -noout -dates -issuer 2>/dev/null`,
          { timeout: 10000 },
        );

        const notBefore = stdout.match(/notBefore=(.+)/)?.[1]?.trim();
        const notAfter = stdout.match(/notAfter=(.+)/)?.[1]?.trim();
        const issuer = stdout.match(/issuer=.*?CN\s*=\s*(.+)/)?.[1]?.trim() || "Let's Encrypt";

        let daysRemaining: number | undefined;
        let status: 'active' | 'expired' = 'active';

        if (notAfter) {
          const expiryDate = new Date(notAfter);
          const now = new Date();
          daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysRemaining < 0) {
            status = 'expired';
            daysRemaining = 0;
          }
        }

        return {
          domain,
          status,
          issuer,
          validFrom: notBefore,
          validTo: notAfter,
          daysRemaining,
          autoRenew: true,
        };
      } catch {
        return none;
      }
    }
  }

  /**
   * List all certificates managed by certbot
   */
  async listCertificates(): Promise<SslCertificate[]> {
    try {
      const { stdout } = await execAsync('sudo -n certbot certificates 2>/dev/null', {
        timeout: 15000,
      });

      if (!stdout || stdout.includes('No certificates found')) {
        return [];
      }

      const certs: SslCertificate[] = [];
      const blocks = stdout.split('Certificate Name:');

      for (const block of blocks.slice(1)) {
        const nameMatch = block.match(/^\s*(\S+)/);
        const domainsMatch = block.match(/Domains:\s*(.+)/);
        const expiryMatch = block.match(/Expiry Date:\s*(\S+ \S+)/);
        const certPathMatch = block.match(/Certificate Path:\s*(\S+)/);

        if (!nameMatch) continue;

        const domain = nameMatch[1].trim();
        let daysRemaining: number | undefined;
        let status: 'active' | 'expired' = 'active';
        let validTo: string | undefined;

        if (expiryMatch) {
          validTo = expiryMatch[1];
          const expiryDate = new Date(validTo);
          const now = new Date();
          daysRemaining = Math.ceil(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysRemaining < 0) {
            status = 'expired';
            daysRemaining = 0;
          }
        }

        certs.push({
          domain,
          status,
          issuer: "Let's Encrypt",
          validTo,
          daysRemaining,
          autoRenew: true,
        });
      }

      return certs;
    } catch {
      return [];
    }
  }

  /**
   * Renew all certificates (or a specific one)
   */
  async renewCertificate(domain?: string): Promise<SslInstallResult> {
    const logs: string[] = [];

    try {
      const cmd = domain
        ? `sudo -n certbot renew --cert-name ${domain} --force-renewal`
        : `sudo -n certbot renew`;

      logs.push(`Running: ${cmd}`);
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
      if (stdout) logs.push(stdout.trim());
      if (stderr) logs.push(stderr.trim());

      const cert = domain ? await this.getCertificateInfo(domain) : undefined;

      return {
        success: true,
        message: domain
          ? `Certificate renewed for ${domain}`
          : 'All certificates renewed',
        certificate: cert,
        logs,
      };
    } catch (error: any) {
      const errOutput = error.stderr || error.stdout || error.message || String(error);
      logs.push(errOutput);
      return {
        success: false,
        message: `Renewal failed: ${errOutput}`,
        logs,
      };
    }
  }

  /**
   * Remove SSL certificate for a domain
   */
  async removeCertificate(domain: string): Promise<{ success: boolean; message: string }> {
    try {
      await execAsync(`sudo -n certbot delete --cert-name ${domain} --non-interactive`, {
        timeout: 30000,
      });

      // Reload nginx to apply changes
      await execAsync('sudo -n systemctl reload nginx');

      return { success: true, message: `SSL certificate removed for ${domain}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to remove certificate: ${msg}` };
    }
  }

  /**
   * Get certbot status
   */
  async getStatus(): Promise<{
    installed: boolean;
    version?: string;
    certificateCount: number;
    renewalTimerActive: boolean;
  }> {
    const installed = await this.isCertbotInstalled();
    if (!installed) {
      return { installed: false, certificateCount: 0, renewalTimerActive: false };
    }

    let version: string | undefined;
    try {
      const { stdout } = await execAsync('certbot --version 2>&1');
      version = stdout.trim();
    } catch {}

    let renewalTimerActive = false;
    try {
      const { stdout } = await execAsync('systemctl is-active certbot.timer 2>/dev/null');
      renewalTimerActive = stdout.trim() === 'active';
    } catch {}

    const certs = await this.listCertificates();

    return {
      installed,
      version,
      certificateCount: certs.length,
      renewalTimerActive,
    };
  }
}
