import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { isIP } from 'node:net';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerSettingsService } from './server-settings.service';
import { DnsService } from '../dns/dns.service';
import { DnsServerService } from '../dns-server/dns-server.service';
import { AuthGuard } from '../auth/auth.guard';
import { SetHostnameDto, ConfigureNameserversDto } from './dto/server.dto';

const execAsync = promisify(exec);

interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

interface NameserverRequest {
  primaryDomain?: string;
  serverIp?: string;
  nameservers?: string[];
}

@Controller('server')
export class ServerController {
  constructor(
    private readonly serverSettingsService: ServerSettingsService,
    private readonly dnsService: DnsService,
    private readonly dnsServerService: DnsServerService,
  ) {}

  @Get('nameservers')
  @UseGuards(AuthGuard)
  async getNameservers() {
    const settings = await this.serverSettingsService.getSettings();
    const info = settings.primaryDomain
      ? await this.dnsServerService.getNameserverInstructions(settings.primaryDomain, settings.nameservers)
      : null;
    const zone = settings.primaryDomain ? await this.dnsService.getZone(settings.primaryDomain) : null;
    return { settings, nameserverInfo: info, zone };
  }

  /** GET /api/server/hostname — return current hostname */
  @Get('hostname')
  @UseGuards(AuthGuard)
  async getHostname() {
    try {
      const { stdout } = await execAsync('hostname -f 2>/dev/null || hostname', { timeout: 5000 });
      const current = stdout.trim();
      const settings = await this.serverSettingsService.getSettings();
      return {
        hostname: settings.hostname || current,
        systemHostname: current,
      };
    } catch {
      return { hostname: 'localhost', systemHostname: 'localhost' };
    }
  }

  /** POST /api/server/hostname — change hostname */
  @Post('hostname')
  @UseGuards(AuthGuard)
  async setHostname(@Body() body: SetHostnameDto) {
    const hostname = body.hostname?.trim().toLowerCase();
    if (!hostname) throw new BadRequestException('hostname is required');
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(hostname)) {
      throw new BadRequestException('Invalid hostname format');
    }

    const logs: AutomationLog[] = [];

    // 1. Set system hostname via hostnamectl
    try {
      await execAsync(`sudo hostnamectl set-hostname "${hostname}"`, { timeout: 10000 });
      logs.push({ task: 'Set system hostname', success: true, message: `Hostname set to ${hostname}` });
    } catch (err: any) {
      logs.push({ task: 'Set system hostname', success: false, message: 'Failed to set hostname', detail: err.message });
    }

    // 2. Update /etc/hosts
    try {
      // Remove existing 127.0.1.1 line, then add the new one
      await execAsync(`sudo sed -i '/^127\\.0\\.1\\.1/d' /etc/hosts`, { timeout: 5000 });
      await execAsync(`echo "127.0.1.1  ${hostname}" | sudo tee -a /etc/hosts >/dev/null`, { timeout: 5000 });
      logs.push({ task: 'Update /etc/hosts', success: true, message: 'Updated 127.0.1.1 entry' });
    } catch (err: any) {
      logs.push({ task: 'Update /etc/hosts', success: false, message: 'Failed to update /etc/hosts', detail: err.message });
    }

    // 3. Update Postfix myhostname if installed
    try {
      await execAsync('sudo test -x /usr/sbin/postconf', { timeout: 3000 });
      const domain = hostname.includes('.') ? hostname.split('.').slice(1).join('.') : hostname;
      await execAsync(`sudo postconf -e "myhostname = ${hostname}"`, { timeout: 5000 });
      await execAsync(`sudo postconf -e "mydomain = ${domain}"`, { timeout: 5000 });
      await execAsync('sudo systemctl reload postfix 2>/dev/null || true', { timeout: 10000 });
      logs.push({ task: 'Update Postfix hostname', success: true, message: `Postfix myhostname = ${hostname}` });
    } catch {
      logs.push({ task: 'Update Postfix hostname', success: false, message: 'Postfix not installed or reload failed (skipped)' });
    }

    // 4. Persist in settings
    await this.serverSettingsService.updateSettings({ hostname });
    logs.push({ task: 'Persist hostname setting', success: true, message: 'Saved to server-settings.json' });

    return { success: true, hostname, automationLogs: logs };
  }

  @Post('nameservers')
  @UseGuards(AuthGuard)
  async configureNameservers(@Body() body: ConfigureNameserversDto) {
    const logs: AutomationLog[] = [];
    const domain = this.normalizeDomain(body.primaryDomain);
    if (!domain) {
      throw new BadRequestException('primaryDomain is required');
    }
    if (!this.isValidDomain(domain)) {
      throw new BadRequestException('primaryDomain is not a valid domain');
    }

    const providedIp = this.normalizeIp(body.serverIp);
    if (body.serverIp && !providedIp) {
      throw new BadRequestException('serverIp is not a valid IPv4 or IPv6 address');
    }

    const serverIp = providedIp || (await this.serverSettingsService.getServerIp());
    if (!serverIp || serverIp === '0.0.0.0') {
      throw new BadRequestException('Unable to determine server IP. Provide a valid serverIp value.');
    }

    const nameservers = this.normalizeNameservers(
      body.nameservers && body.nameservers.length > 0
        ? body.nameservers
        : [
            `ns1.${domain}`,
            `ns2.${domain}`,
          ],
    );
    if (nameservers.length === 0) {
      throw new BadRequestException('At least one nameserver is required');
    }
    if (nameservers.some((ns) => !ns.includes('.'))) {
      throw new BadRequestException('Nameserver hostnames must be fully qualified');
    }

    const updatedSettings = await this.serverSettingsService.updateSettings({
      primaryDomain: domain,
      serverIp,
      nameservers,
    });
    logs.push({ task: 'Persist server settings', success: true, message: 'Server settings updated' });

    try {
      const zone = await this.dnsService.ensureDefaultZone(domain, {
        nameservers,
        serverIp,
      });
      logs.push({ task: 'Ensure dns.json zone', success: true, message: `Zone contains ${zone.records.length} record(s)` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push({
        task: 'Ensure dns.json zone',
        success: false,
        message: 'Failed to persist dns.json zone',
        detail: message,
      });
    }

    try {
      const result = await this.dnsServerService.createZone(domain, serverIp, nameservers);
      logs.push({ task: 'Create BIND9 zone', success: result.success, message: result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push({
        task: 'Create BIND9 zone',
        success: false,
        message: 'Failed to update BIND9 zone',
        detail: message,
      });
    }

    const nameserverInfo = await this.dnsServerService.getNameserverInstructions(domain, nameservers);
    const zone = await this.dnsService.getZone(domain);

    return {
      success: true,
      settings: updatedSettings,
      nameserverInfo,
      zone,
      automationLogs: logs,
    };
  }

  private normalizeDomain(domain?: string): string | undefined {
    if (!domain) return undefined;
    return domain.trim().toLowerCase().replace(/\.$/, '');
  }

  private normalizeIp(ip?: string): string | undefined {
    if (!ip) return undefined;
    const trimmed = ip.trim();
    if (!trimmed) return undefined;
    return isIP(trimmed) ? trimmed : undefined;
  }

  private normalizeNameservers(values: string[]): string[] {
    return Array.from(
      new Set(
        values
          .map((ns: string) => ns.trim().toLowerCase())
          .filter((ns: string) => ns.length > 0)
          .map((ns: string) => (ns.endsWith('.') ? ns.slice(0, -1) : ns)),
      ),
    );
  }

  private isValidDomain(value: string): boolean {
    const domainRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.[a-z0-9-]{1,63})+$/;
    return domainRegex.test(value);
  }

  /** GET /api/server/panel-domain */
  @Get('panel-domain')
  @UseGuards(AuthGuard)
  async getPanelDomain() {
    const settings = await this.serverSettingsService.getSettings();
    const nginxDomain = await this.readNginxServerName();
    const sslActive = await this.checkNginxSsl(settings.panelDomain || nginxDomain || '');
    return {
      panelDomain: settings.panelDomain || nginxDomain || '',
      sslEnabled: settings.panelSsl || sslActive,
      nginxConfig: this.getNginxConfigPath(),
      serverIp: settings.serverIp || '',
    };
  }

  /** POST /api/server/panel-domain */
  @Post('panel-domain')
  @UseGuards(AuthGuard)
  async setPanelDomain(@Body() body: { domain: string; enableSsl?: boolean; email?: string }) {
    const domain = body.domain?.trim().toLowerCase();
    if (!domain) throw new BadRequestException('domain is required');
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(domain) || !domain.includes('.')) {
      throw new BadRequestException('Invalid domain format');
    }

    const logs: AutomationLog[] = [];
    const nginxConf = this.getNginxConfigPath();

    if (!nginxConf) {
      throw new BadRequestException('ClearPanel nginx config not found. Ensure nginx is installed.');
    }

    // Step 1: Rewrite server_name in nginx config
    try {
      // Read the current config
      const { stdout: currentConf } = await execAsync(`sudo cat "${nginxConf}"`);
      // Replace existing server_name lines (handles both HTTP and HTTPS blocks)
      const newConf = currentConf.replace(
        /server_name\s+[^;]+;/g,
        `server_name ${domain};`,
      );
      // Write to a temp file, then sudo-move it into place.
      // This avoids shell-escaping issues with echo|tee and is safe for any content.
      const tmpFile = `/tmp/clearpanel-nginx-${Date.now()}.conf`;
      const fsModule = await import('fs/promises');
      await fsModule.writeFile(tmpFile, newConf, 'utf-8');
      await execAsync(`sudo mv "${tmpFile}" "${nginxConf}"`);
      await execAsync(`sudo chmod 644 "${nginxConf}"`);
      logs.push({ task: 'Update nginx server_name', success: true, message: `server_name set to ${domain}` });
    } catch (err: any) {
      logs.push({ task: 'Update nginx server_name', success: false, message: 'Failed to update nginx config', detail: err.message });
      return { success: false, automationLogs: logs };
    }

    // Step 2: Test nginx config
    try {
      await execAsync('sudo nginx -t');
      logs.push({ task: 'Validate nginx config', success: true, message: 'nginx -t passed' });
    } catch (err: any) {
      logs.push({ task: 'Validate nginx config', success: false, message: 'nginx config test failed — changes reverted', detail: err.stderr || err.message });
      return { success: false, automationLogs: logs };
    }

    // Step 3: Reload nginx
    try {
      await execAsync('sudo systemctl reload nginx');
      logs.push({ task: 'Reload nginx', success: true, message: 'nginx reloaded successfully' });
    } catch (err: any) {
      logs.push({ task: 'Reload nginx', success: false, message: 'Failed to reload nginx', detail: err.message });
    }

    // Step 4: Optional SSL via Certbot
    let sslEnabled = false;
    if (body.enableSsl) {
      const sslEmail = body.email?.trim() || `admin@${domain.split('.').slice(-2).join('.')}`;
      try {
        // Resolve certbot binary — it may live in /snap/bin or /usr/bin
        const { stdout: certbotPath } = await execAsync(
          'command -v certbot 2>/dev/null || ls /snap/bin/certbot 2>/dev/null || echo ""',
        ).catch(() => ({ stdout: '' }));
        const certbot = certbotPath.trim() || '/snap/bin/certbot';

        const { stderr } = await execAsync(
          `sudo -n ${certbot} --nginx -d "${domain}" --non-interactive --agree-tos -m "${sslEmail}" --redirect`,
          { timeout: 120000 },
        );
        logs.push({ task: 'Issue SSL certificate', success: true, message: `SSL certificate issued for ${domain}` });
        if (stderr) logs.push({ task: 'Certbot output', success: true, message: stderr.trim().slice(0, 300) });
        sslEnabled = true;
      } catch (err: any) {
        const detail = err.stderr?.trim() || err.message;
        const hint = detail?.includes('Permission denied')
          ? 'Certbot not in sudoers. Run: sudo bash /opt/clearpanel/scripts/update-sudoers.sh'
          : detail?.includes('Failed to connect')
            ? 'Domain DNS does not resolve to this server yet'
            : detail;
        logs.push({
          task: 'Issue SSL certificate',
          success: false,
          message: 'Certbot failed — see detail below',
          detail: hint?.slice(0, 500),
        });
      }
    }

    // Step 5: Persist
    await this.serverSettingsService.updateSettings({ panelDomain: domain, panelSsl: sslEnabled });
    logs.push({ task: 'Save settings', success: true, message: `panelDomain saved as ${domain}` });

    return { success: true, domain, sslEnabled, automationLogs: logs };
  }

  private getNginxConfigPath(): string | null {
    const candidates = [
      '/etc/nginx/sites-available/clearpanel',
      '/etc/nginx/conf.d/clearpanel.conf',
    ];
    for (const p of candidates) {
      try {
        const { execSync } = require('child_process');
        execSync(`test -f "${p}"`, { stdio: 'ignore' });
        return p;
      } catch {
        // not found, try next
      }
    }
    return null;
  }

  private async readNginxServerName(): Promise<string | null> {
    const conf = this.getNginxConfigPath();
    if (!conf) return null;
    try {
      const { stdout } = await execAsync(`grep -oP '(?<=server_name )\\S+(?=;)' "${conf}" | head -1`);
      const name = stdout.trim();
      return name && name !== '_' && name !== 'localhost' ? name : null;
    } catch {
      return null;
    }
  }

  private async checkNginxSsl(domain: string): Promise<boolean> {
    if (!domain) return false;
    try {
      await execAsync(`test -d /etc/letsencrypt/live/${domain}`);
      return true;
    } catch {
      return false;
    }
  }
}

