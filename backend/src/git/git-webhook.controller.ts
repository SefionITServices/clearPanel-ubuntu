import { Controller, Post, Param, Headers, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { GitService } from './git.service';

@Controller('git-webhook')
export class GitWebhookController {
  constructor(private readonly git: GitService) {}

  @Post('github/:webhookId')
  async githubWebhook(
    @Param('webhookId') webhookId: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
    @Res() res: Response
  ) {
    if (!signature) {
      return res.status(401).send('Missing signature');
    }

    try {
      const result = await this.git.processGithubWebhook(webhookId, signature, payload);
      return res.json(result);
    } catch (error: any) {
      if (error.message === 'Invalid signature') {
        return res.status(401).send('Invalid signature');
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  }
}
