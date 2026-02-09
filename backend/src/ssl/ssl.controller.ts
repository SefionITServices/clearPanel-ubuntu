import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SslService } from './ssl.service';

@Controller('ssl')
export class SslController {
  constructor(private readonly sslService: SslService) {}

  /** GET /api/ssl/status — certbot installation status */
  @Get('status')
  async getStatus() {
    return this.sslService.getStatus();
  }

  /** GET /api/ssl/certificates — list all managed certificates */
  @Get('certificates')
  async listCertificates() {
    return this.sslService.listCertificates();
  }

  /** GET /api/ssl/certificates/:domain — single domain certificate info */
  @Get('certificates/:domain')
  async getCertificate(@Param('domain') domain: string) {
    return this.sslService.getCertificateInfo(domain);
  }

  /** POST /api/ssl/install — install SSL for a domain */
  @Post('install')
  async installCertificate(
    @Body() body: { domain: string; email: string; includeWww?: boolean },
  ) {
    if (!body.domain || !body.email) {
      throw new HttpException(
        'domain and email are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.sslService.installCertificate(
      body.domain,
      body.email,
      body.includeWww ?? true,
    );
  }

  /** POST /api/ssl/renew — renew a specific certificate or all */
  @Post('renew')
  async renewCertificate(@Body() body: { domain?: string }) {
    return this.sslService.renewCertificate(body.domain);
  }

  /** POST /api/ssl/install-certbot — install certbot if missing */
  @Post('install-certbot')
  async installCertbot() {
    return this.sslService.installCertbot();
  }

  /** DELETE /api/ssl/certificates/:domain — remove certificate */
  @Delete('certificates/:domain')
  async removeCertificate(@Param('domain') domain: string) {
    const result = await this.sslService.removeCertificate(domain);
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return result;
  }
}
