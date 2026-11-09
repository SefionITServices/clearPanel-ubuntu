import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { MailGatewayService } from './mail-gateway.service';
import { MailFolder } from './mail-sync.model';

@Controller('mail/sync')
export class MailGatewayController {
  constructor(private readonly mailGatewayService: MailGatewayService) {}

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

  @Post('test/simulate-inbound')
  async simulateInboundEmail(
    @Body()
    body: {
      mailboxEmail: string;
      fromName?: string;
      fromEmail?: string;
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
    },
  ) {
    if (!body?.mailboxEmail) {
      throw new BadRequestException('mailboxEmail is required');
    }

    const domain = body.mailboxEmail.split('@')[1] || 'company.com';
    return this.mailGatewayService.handleInboundDelivery(body.mailboxEmail, {
      from: {
        name: body.fromName || 'Stripe Billing',
        email: body.fromEmail || `invoicing@stripe.${domain}`,
      },
      to: [{ name: body.mailboxEmail.split('@')[0], email: body.mailboxEmail }],
      subject: body.subject || `Receipt for Payment to Acme Corp (#${Math.floor(10000 + Math.random() * 90000)})`,
      bodyText: body.bodyText || `Your payment of $499.00 USD was successfully processed. Thank you for your business!`,
      bodyHtml:
        body.bodyHtml ||
        `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #635bff;">Payment Receipt</h2>
          <p>Amount: <strong>$499.00 USD</strong></p>
          <p>Status: <span style="color: #2e7d32; font-weight: bold;">Paid</span></p>
          <p>Thanks for choosing our services!</p>
        </div>
      `,
      security: {
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        tlsVersion: 'TLSv1.3',
        signedBy: 'stripe.com',
      },
    });
  }
}

