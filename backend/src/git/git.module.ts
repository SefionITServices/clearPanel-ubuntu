import { Module } from '@nestjs/common';
import { GitController } from './git.controller';
import { GitWebhookController } from './git-webhook.controller';
import { GitService } from './git.service';
import { CicdRecipeService } from './cicd-recipe.service';

@Module({
  controllers: [GitController, GitWebhookController],
  providers: [GitService, CicdRecipeService],
  exports: [GitService, CicdRecipeService],
})
export class GitModule {}
