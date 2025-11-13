import { Body, Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { DomainsService } from './domains.service';
import { DnsService } from '../dns/dns.service';
import { WebServerService } from '../webserver/webserver.service';
import { DnsServerService } from '../dns-server/dns-server.service';
import { ConfigService } from '@nestjs/config';

@Controller('domains')
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly dnsService: DnsService,
    private readonly webServerService: WebServerService,
    private readonly dnsServerService: DnsServerService,
    private readonly configService: ConfigService
  ) {}

  @Post()
  async addDomain(@Body() body: { name: string; folderPath?: string }) {
    const domain = await this.domainsService.addDomain(body.name, body.folderPath);
    // Return combined info with DNS zone for convenience
    const zone = await this.dnsService.getZone(body.name);
    const serverIp = this.configService.get<string>('SERVER_IP') || '0.0.0.0';
    const dnsInstructions = this.webServerService.getDNSInstructions(body.name, serverIp);
    const nameserverInfo = await this.dnsServerService.getNameserverInstructions(body.name);
    return { domain, dnsZone: zone, dnsInstructions, nameserverInfo };
  }

  @Get()
  async listDomains() {
    return this.domainsService.listDomains();
  }

  @Get(':id/dns-instructions')
  async getDNSInstructions(@Param('id') id: string) {
    const domains = await this.domainsService.listDomains();
    const domain = domains.find(d => d.id === id);
    if (!domain) {
      return { success: false, message: 'Domain not found' };
    }
    const serverIp = this.configService.get<string>('SERVER_IP') || '0.0.0.0';
    const dnsInstructions = this.webServerService.getDNSInstructions(domain.name, serverIp);
    return { domain: domain.name, serverIp, instructions: dnsInstructions };
  }

  @Put(':id/path')
  async updateDomainPath(@Param('id') id: string, @Body() body: { folderPath: string }) {
    return this.domainsService.updateDomainPath(id, body.folderPath);
  }

  @Delete(':id')
  async deleteDomain(@Param('id') id: string) {
    const result = await this.domainsService.deleteDomain(id);
    if (!result) {
      return { success: false, message: 'Domain not found' };
    }
    return { success: true, message: 'Domain deleted successfully', domain: result };
  }
}
