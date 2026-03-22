import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { WebServerService } from './webserver.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';
import { CreateVhostDto } from './dto/webserver.dto';

@Controller('webserver')
@UseGuards(AuthGuard)
export class WebServerController {
  constructor(
    private readonly webServerService: WebServerService,
    private readonly configService: ConfigService
  ) {}

  @Get('status')
  async getStatus() {
    return this.webServerService.getNginxStatus();
  }

  @Post('install')
  async installNginx() {
    return this.webServerService.installNginx();
  }

  @Post('vhost/:domain')
  async createVirtualHost(@Param('domain') domain: string, @Body() body: CreateVhostDto) {
    return this.webServerService.createVirtualHost(domain, body.documentRoot, body.phpVersion, body.proxyPort);
  }

  @Delete('vhost/:domain')
  async removeVirtualHost(@Param('domain') domain: string) {
    return this.webServerService.removeVirtualHost(domain);
  }

  @Get('dns-instructions/:domain')
  async getDNSInstructions(@Param('domain') domain: string) {
    const serverIp = this.configService.get<string>('SERVER_IP') || '0.0.0.0';
    const instructions = this.webServerService.getDNSInstructions(domain, serverIp);
    return { domain, serverIp, instructions };
  }
}
