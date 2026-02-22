import { Controller, Get, Post, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { DnsServerService } from './dns-server.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('dns-server')
@UseGuards(AuthGuard)
export class DnsServerController {
  constructor(private readonly dnsServerService: DnsServerService) {}

  @Get('status')
  async getStatus() {
    return this.dnsServerService.getStatus();
  }

  @Post('install')
  async install() {
    const result = await this.dnsServerService.install();
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return result;
  }

  @Post('reload')
  async reload() {
    try {
      await this.dnsServerService.reload();
      return { success: true, message: 'DNS server reloaded successfully' };
    } catch (error: any) {
      throw new HttpException(
        `Failed to reload DNS server: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('nameserver-instructions/:domain')
  async getNameserverInstructions(@Param('domain') domain: string) {
    return this.dnsServerService.getNameserverInstructions(domain);
  }
}
