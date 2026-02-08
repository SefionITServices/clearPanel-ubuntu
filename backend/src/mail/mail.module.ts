import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MailAutomationService } from './mail-automation.service';
import { MailStatusService } from './mail-status.service';
import { MailHistoryService } from './mail-history.service';
import { ServerModule } from '../server/server.module';

@Module({
  imports: [ServerModule],
  controllers: [MailController],
  providers: [MailService, MailAutomationService, MailStatusService, MailHistoryService],
  exports: [MailService, MailStatusService],
})
export class MailModule {}
