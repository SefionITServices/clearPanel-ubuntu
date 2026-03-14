import { Module } from '@nestjs/common';
import { MailingListsController } from './mailing-lists.controller';
import { MailingListsService } from './mailing-lists.service';

@Module({
  controllers: [MailingListsController],
  providers: [MailingListsService],
})
export class MailingListsModule {}
