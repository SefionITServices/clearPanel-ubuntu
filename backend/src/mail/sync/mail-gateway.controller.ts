import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { MailGatewayService } from './mail-gateway.service';
import { MailFolder } from './mail-sync.model';

@Controller('mail/sync')
export class MailGatewayController {
  constructor(private readonly mailGatewayService: MailGatewayService) {}

  @Post('auth/login')
  async login(@Body() body: { email: string; password?: string }) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException('Email and password are required');
    }
    return this.mailGatewayService.authenticate(body.email, body.password);
  }

  @Post('auth/sso')
  async ssoLogin(@Body() body: { ssoToken: string }) {
    if (!body?.ssoToken) {
      throw new BadRequestException('ssoToken is required');
    }
    return this.mailGatewayService.authenticateSso(body.ssoToken);
  }

  @Post('refresh')
  async refreshMailbox(@Body('mailbox') mailbox: string) {
    if (!mailbox) {
      throw new BadRequestException('mailbox is required');
    }
    return this.mailGatewayService.forceRefreshMailbox(mailbox);
  }

  @Get('threads')
  async listThreads(
    @Query('mailbox') mailbox: string,
    @Query('folder') folder?: MailFolder,
    @Query('label') label?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!mailbox) {
      throw new BadRequestException('mailbox query param is required (e.g. user@domain.com)');
    }
    return this.mailGatewayService.getThreads(mailbox, {
      folder,
      label,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('threads/:id')
  async getThread(
    @Query('mailbox') mailbox: string,
    @Param('id') threadId: string,
  ) {
    if (!mailbox) {
      throw new BadRequestException('mailbox query param is required');
    }
    const thread = await this.mailGatewayService.getThreadById(mailbox, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }
    return thread;
  }

  @Post('send')
  async sendEmail(
    @Body()
    body: {
      mailboxEmail: string;
      to: { name: string; email: string }[];
      cc?: { name: string; email: string }[];
      bcc?: { name: string; email: string }[];
      subject: string;
      bodyHtml?: string;
      bodyText?: string;
      attachments?: any[];
      replyToThreadId?: string;
      inReplyToMessageId?: string;
      undoGraceSeconds?: number;
    },
  ) {
    if (!body?.mailboxEmail) {
      throw new BadRequestException('mailboxEmail is required');
    }
    if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
      throw new BadRequestException('At least one recipient (to) is required');
    }

    return this.mailGatewayService.queueSend(body.mailboxEmail, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject || '(No Subject)',
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      attachments: body.attachments,
      replyToThreadId: body.replyToThreadId,
      inReplyToMessageId: body.inReplyToMessageId,
      undoGraceSeconds: body.undoGraceSeconds,
    });
  }

  @Post('cancel-send/:pendingId')
  async cancelSend(
    @Param('pendingId') pendingId: string,
    @Body('mailboxEmail') mailboxEmail: string,
  ) {
    if (!mailboxEmail) {
      throw new BadRequestException('mailboxEmail is required');
    }
    const cancelled = await this.mailGatewayService.cancelSend(mailboxEmail, pendingId);
    if (!cancelled) {
      throw new BadRequestException('Could not cancel send (timeout elapsed or invalid pendingId)');
    }
    return { success: true, message: 'Send cancelled and message restored to Drafts' };
  }

  @Patch('threads/batch')
  async batchUpdate(
    @Body()
    body: {
      mailboxEmail: string;
      threadIds: string[];
      markAsRead?: boolean;
      folder?: MailFolder;
      isStarred?: boolean;
      addLabels?: string[];
      removeLabels?: string[];
    },
  ) {
    if (!body?.mailboxEmail || !body.threadIds || !Array.isArray(body.threadIds)) {
      throw new BadRequestException('mailboxEmail and threadIds array are required');
    }
    return this.mailGatewayService.batchUpdateThreads(body.mailboxEmail, body.threadIds, {
      markAsRead: body.markAsRead,
      folder: body.folder,
      isStarred: body.isStarred,
      addLabels: body.addLabels,
      removeLabels: body.removeLabels,
    });
  }

  @Get('search')
  async search(
    @Query('mailbox') mailbox: string,
    @Query('q') query: string,
  ) {
    if (!mailbox) {
      throw new BadRequestException('mailbox is required');
    }
    return this.mailGatewayService.search(mailbox, query || '');
  }

  @Get('stats')
  async getStats(@Query('mailbox') mailbox: string) {
    if (!mailbox) {
      throw new BadRequestException('mailbox is required');
    }
    return this.mailGatewayService.getStats(mailbox);
  }

  // ---------------------------------------------------------------------------
  // Attachment Handling (Download & Upload)
  // ---------------------------------------------------------------------------

  @Get('attachments/:messageId/:attachmentId')
  async downloadAttachment(
    @Query('mailbox') mailbox: string,
    @Param('messageId') messageId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    if (!mailbox) {
      throw new BadRequestException('mailbox query parameter is required');
    }
    const att = await this.mailGatewayService.getAttachment(mailbox, messageId, attachmentId);
    if (!att) {
      throw new NotFoundException('Attachment not found');
    }

    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(att.filename)}"`,
    );
    res.setHeader('Content-Length', att.content.length);
    res.end(att.content);
  }

  @Post('attachments/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('File is required in upload form');
    }
    return this.mailGatewayService.saveUploadedAttachment(file);
  }

  // ---------------------------------------------------------------------------
  // Contacts Autocomplete
  // ---------------------------------------------------------------------------

  @Get('contacts/suggest')
  async suggestContacts(
    @Query('mailbox') mailbox: string,
    @Query('q') query: string,
  ) {
    if (!mailbox) {
      throw new BadRequestException('mailbox is required');
    }
    return this.mailGatewayService.suggestContacts(mailbox, query || '');
  }

  // ---------------------------------------------------------------------------
  // User Profile & Avatar
  // ---------------------------------------------------------------------------

  @Get('profile')
  async getProfile(@Query('mailbox') mailbox: string) {
    if (!mailbox) {
      throw new BadRequestException('mailbox query param is required');
    }
    return this.mailGatewayService.getMailboxProfile(mailbox);
  }

  @Post('profile')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async updateProfile(
    @Body('mailbox') mailbox: string,
    @Body('name') name?: string,
    @UploadedFile() file?: any,
  ) {
    if (!mailbox) {
      throw new BadRequestException('mailbox is required');
    }
    return this.mailGatewayService.updateMailboxProfile(mailbox, name, file);
  }

  // ---------------------------------------------------------------------------
  // Inbound Webhooks
  // ---------------------------------------------------------------------------

  @Post('webhook/incoming')
  async handleIncomingWebhook(
    @Body()
    body: {
      mailboxEmail: string;
      from: { name: string; email: string };
      to: { name: string; email: string }[];
      subject: string;
      bodyHtml?: string;
      bodyText?: string;
      attachments?: any[];
      headers?: Record<string, string>;
      security?: any;
    },
  ) {
    if (!body?.mailboxEmail || !body.from || !body.subject) {
      throw new BadRequestException('mailboxEmail, from, and subject are required');
    }
    return this.mailGatewayService.handleInboundDelivery(body.mailboxEmail, body);
  }
}
