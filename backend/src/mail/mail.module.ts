import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailController } from './mail.controller';
import { MailAutoconfigController } from './mail-autoconfig.controller';
import { MailGatewayController } from './sync/mail-gateway.controller';
import { MailService } from './mail.service';
import { MailAutomationService } from './mail-automation.service';
import { MailStatusService } from './mail-status.service';
import { MailHistoryService } from './mail-history.service';
import { MailSsoService } from './mail-sso.service';
import { MailGatewayService } from './sync/mail-gateway.service';
import { MailGateway } from './sync/mail-gateway.gateway';
import { ServerModule } from '../server/server.module';
import { DnsModule } from '../dns/dns.module';
import { DnsServerModule } from '../dns-server/dns-server.module';
import { AppStoreModule } from '../app-store/app-store.module';

@Module({
  imports: [ConfigModule, ServerModule, DnsModule, DnsServerModule, AppStoreModule],
  controllers: [MailController, MailAutoconfigController, MailGatewayController],
  providers: [
    MailService,
    MailAutomationService,
    MailStatusService,
    MailHistoryService,
    MailSsoService,
    MailGatewayService,
    MailGateway,
  ],
  exports: [MailService, MailStatusService, MailGatewayService, MailGateway],
})
export class MailModule {}
