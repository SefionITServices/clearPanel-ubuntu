import { Controller, Get, Post, Query, Req, Res, Header } from '@nestjs/common';
import { Request, Response } from 'express';
import { MailService } from './mail.service';
import { ServerSettingsService } from '../server/server-settings.service';

/**
 * Autoconfig / Autodiscover controller.
 *
 * Serves email-client auto-configuration for:
 * - Thunderbird / GNOME / K-9: GET /mail/autoconfig/mail/config-v1.1.xml?emailaddress=user@domain
 * - Outlook:                    POST /mail/autodiscover/autodiscover.xml  (body contains XML with email)
 * - Apple / generic:            GET /mail/autoconfig/mail/config-v1.1.xml (same endpoint)
 *
 * All responses are XML with the appropriate content types.
 */
@Controller('mail')
export class MailAutoconfigController {
  constructor(
    private readonly mailService: MailService,
    private readonly serverSettings: ServerSettingsService,
  ) {}

  // ---- Thunderbird / GNOME / K-9 autoconfig ----

  @Get('autoconfig/mail/config-v1.1.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async getAutoconfig(
    @Query('emailaddress') emailAddress: string,
    @Res() res: Response,
  ) {
    const domain = this.extractDomain(emailAddress);
    const hostname = await this.getMailHostname(domain);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="${this.escapeXml(domain)}">
    <domain>${this.escapeXml(domain)}</domain>
    <displayName>${this.escapeXml(domain)} Mail</displayName>
    <displayShortName>${this.escapeXml(domain)}</displayShortName>

    <incomingServer type="imap">
      <hostname>${this.escapeXml(hostname)}</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>

    <incomingServer type="pop3">
      <hostname>${this.escapeXml(hostname)}</hostname>
      <port>995</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>

    <outgoingServer type="smtp">
      <hostname>${this.escapeXml(hostname)}</hostname>
      <port>465</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>

    <outgoingServer type="smtp">
      <hostname>${this.escapeXml(hostname)}</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>`;

    res.type('application/xml').send(xml);
  }

  // ---- Outlook Autodiscover ----

  @Post('autodiscover/autodiscover.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async postAutodiscover(@Req() req: Request, @Res() res: Response) {
    // Parse email from Outlook's XML body
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const emailMatch = body.match(/<EMailAddress>([^<]+)<\/EMailAddress>/i);
    const email = emailMatch?.[1] || '';
    const domain = this.extractDomain(email);
    const hostname = await this.getMailHostname(domain);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <Account>
      <AccountType>email</AccountType>
      <Action>settings</Action>
      <Protocol>
        <Type>IMAP</Type>
        <Server>${this.escapeXml(hostname)}</Server>
        <Port>993</Port>
        <DomainRequired>off</DomainRequired>
        <LoginName>${this.escapeXml(email)}</LoginName>
        <SPA>off</SPA>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>${this.escapeXml(hostname)}</Server>
        <Port>465</Port>
        <DomainRequired>off</DomainRequired>
        <LoginName>${this.escapeXml(email)}</LoginName>
        <SPA>off</SPA>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>`;

    res.type('application/xml').send(xml);
  }

  // ---- Helpers ----

  private extractDomain(email: string | undefined): string {
    if (!email || !email.includes('@')) return 'unknown';
    return email.split('@')[1].toLowerCase();
  }

  private async getMailHostname(domain: string): Promise<string> {
    // Try to get hostname from server settings, fall back to mail.<domain>
    try {
      const settings = await this.serverSettings.getSettings();
      if (settings.primaryDomain) {
        return `mail.${settings.primaryDomain}`;
      }
    } catch { /* ignore */ }
    return `mail.${domain}`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
