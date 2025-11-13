import { Controller, Get, Param, Post, Body, Put, Delete } from '@nestjs/common';
import { DnsService } from './dns.service';

@Controller('dns')
export class DnsController {
  constructor(private readonly dnsService: DnsService) {}

  @Get('zones')
  async listZones() {
    return this.dnsService.listZones();
  }

  @Get('zones/:domain')
  async getZone(@Param('domain') domain: string) {
    return this.dnsService.getZone(domain);
  }

  @Post('zones/:domain/records')
  async addRecord(@Param('domain') domain: string, @Body() body: { type: 'A'|'CNAME'|'MX'|'TXT'; name: string; value: string; ttl?: number; priority?: number }) {
    return this.dnsService.addRecord(domain, { type: body.type, name: body.name, value: body.value, ttl: body.ttl ?? 3600, priority: body.priority });
  }

  @Put('zones/:domain/records/:id')
  async updateRecord(@Param('domain') domain: string, @Param('id') id: string, @Body() body: { type?: 'A'|'CNAME'|'MX'|'TXT'; name?: string; value?: string; ttl?: number; priority?: number }) {
    return this.dnsService.updateRecord(domain, id, body);
  }

  @Delete('zones/:domain/records/:id')
  async deleteRecord(@Param('domain') domain: string, @Param('id') id: string) {
    return { deleted: await this.dnsService.deleteRecord(domain, id) };
  }
}
