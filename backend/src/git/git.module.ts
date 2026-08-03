import { Module } from '@nestjs/common';
import { GitController } from './git.controller';
import { GitWebhookController } from './git-webhook.controller';
import { GitService } from './git.service';

@Module({
  controllers: [GitController, GitWebhookController],
  providers: [GitService],
})
export class GitModule {}
