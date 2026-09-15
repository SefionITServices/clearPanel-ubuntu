import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailController } from './mail.controller';
import { MailAutoconfigController } from './mail-autoconfig.controller';
import { MailService } from './mail.service';
import { MailAutomationService } from './mail-automation.service';
import { MailStatusService } from './mail-status.service';
import { MailHistoryService } from './mail-history.service';
import { MailSsoService } from './mail-sso.service';
import { ServerModule } from '../server/server.module';
import { DnsModule } from '../dns/dns.module';
import { DnsServerModule } from '../dns-server/dns-server.module';
import { AppStoreModule } from '../app-store/app-store.module';

@Module({
  imports: [ConfigModule, ServerModule, DnsModule, DnsServerModule, AppStoreModule],
  controllers: [MailController, MailAutoconfigController],
  providers: [MailService, MailAutomationService, MailStatusService, MailHistoryService, MailSsoService],
  exports: [MailService, MailStatusService],
})
export class MailModule {}
