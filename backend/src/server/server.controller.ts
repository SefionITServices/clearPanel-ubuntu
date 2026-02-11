import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { isIP } from 'node:net';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServerSettingsService } from './server-settings.service';
import { DnsService } from '../dns/dns.service';
import { DnsServerService } from '../dns-server/dns-server.service';
import { AuthGuard } from '../auth/auth.guard';

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
@UseGuards(AuthGuard)
export class ServerController {
  constructor(
    private readonly serverSettingsService: ServerSettingsService,
    private readonly dnsService: DnsService,
    private readonly dnsServerService: DnsServerService,
  ) {}

  @Get('nameservers')
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
  async setHostname(@Body() body: { hostname: string }) {
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
      // Add/update the 127.0.1.1 line for the new hostname
      await execAsync(
        `sudo sed -i '/^127\.0\.1\.1/d' /etc/hosts && echo "127.0.1.1  ${hostname}" | sudo tee -a /etc/hosts >/dev/null`,
        { timeout: 5000 },
      );
      logs.push({ task: 'Update /etc/hosts', success: true, message: 'Updated 127.0.1.1 entry' });
    } catch (err: any) {
      logs.push({ task: 'Update /etc/hosts', success: false, message: 'Failed to update /etc/hosts', detail: err.message });
    }

    // 3. Update Postfix myhostname if installed
    try {
      await execAsync(`command -v postconf`, { timeout: 3000 });
      const domain = hostname.includes('.') ? hostname.split('.').slice(1).join('.') : hostname;
      await execAsync(`sudo postconf -e "myhostname = ${hostname}"`, { timeout: 5000 });
      await execAsync(`sudo postconf -e "mydomain = ${domain}"`, { timeout: 5000 });
      await execAsync('sudo systemctl reload postfix', { timeout: 10000 });
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
  async configureNameservers(@Body() body: NameserverRequest) {
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
          .map((ns) => ns.trim().toLowerCase())
          .filter((ns) => ns.length > 0)
          .map((ns) => (ns.endsWith('.') ? ns.slice(0, -1) : ns)),
      ),
    );
  }

  private isValidDomain(value: string): boolean {
    const domainRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.[a-z0-9-]{1,63})+$/;
    return domainRegex.test(value);
  }
}
