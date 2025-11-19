import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { isIP } from 'node:net';
import { ServerSettingsService } from './server-settings.service';
import { DnsService } from '../dns/dns.service';
import { DnsServerService } from '../dns-server/dns-server.service';

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
  async getNameservers() {
    const settings = await this.serverSettingsService.getSettings();
    const info = settings.primaryDomain
      ? await this.dnsServerService.getNameserverInstructions(settings.primaryDomain, settings.nameservers)
      : null;
    const zone = settings.primaryDomain ? await this.dnsService.getZone(settings.primaryDomain) : null;
    return { settings, nameserverInfo: info, zone };
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
