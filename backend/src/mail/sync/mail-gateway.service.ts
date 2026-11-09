import { Injectable, Logger, OnModuleInit, OnModuleDestroy, forwardRef, Inject } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  EmailMessage,
  EmailThread,
  EmailAddress,
  MailFolder,
  PendingSendItem,
  MailboxStats,
} from './mail-sync.model';
import { getDataFilePath } from '../../common/paths';
import { MailGateway } from './mail-gateway.gateway';
import { MailStorageService } from './mail-storage.service';
import { MailSsoService } from '../mail-sso.service';

interface MailboxStore {
  threads: Map<string, EmailThread>;
  messages: Map<string, EmailMessage>;
  lastSyncedAt?: number;
}

@Injectable()
export class MailGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailGatewayService.name);
  private readonly stores = new Map<string, MailboxStore>();
  private readonly pendingSends = new Map<string, PendingSendItem>();
  private dispatchInterval: NodeJS.Timeout | null = null;
  private watchInterval: NodeJS.Timeout | null = null;
  private readonly storageDir = getDataFilePath('mail-sync');

  constructor(
    @Inject(forwardRef(() => MailGateway))
    private readonly gateway: MailGateway,
    private readonly storageService: MailStorageService,
    private readonly ssoService: MailSsoService,
  ) {}

  async onModuleInit() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch {}

    // 1. Process pending sends queue (Undo Send ticker)
    this.dispatchInterval = setInterval(() => {
      this.processPendingSends().catch((err) => {
        this.logger.error(`Error processing pending sends: ${err.message}`);
      });
    }, 1000);

    // 2. Background Mailbox Watcher (Sync new messages from /var/mail and /var/mail/vhosts)
    this.watchInterval = setInterval(() => {
      this.checkActiveStoresForNewMail().catch(() => {});
    }, 4000);
  }

  onModuleDestroy() {
    if (this.dispatchInterval) {
      clearInterval(this.dispatchInterval);
      this.dispatchInterval = null;
    }
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  private async checkActiveStoresForNewMail() {
    for (const [mailboxEmail, store] of this.stores.entries()) {
      const prevCount = store.messages.size;
      await this.syncFromMaildir(mailboxEmail, store);
      if (store.messages.size > prevCount) {
        this.gateway.emitToMailbox(mailboxEmail, 'mail:store_refreshed', {
          mailboxEmail,
          totalMessages: store.messages.size,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Subject Normalization & Threading
  // ---------------------------------------------------------------------------

  normalizeSubject(subject: string): string {
    if (!subject) return '(No Subject)';
    return subject
      .replace(/^(\s*(re|fwd|fw|aw|antw|wg)\s*:\s*)+/i, '')
      .replace(/^\[(external|ext)\]\s*/i, '')
      .trim();
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  async authenticate(email: string, pass: string): Promise<{ token: string; email: string }> {
    const res = await this.storageService.verifyCredentials(email, pass);
    if (!res.valid) {
      throw new Error('Invalid email address or password');
    }
    const token = Buffer.from(JSON.stringify({ email: res.email, ts: Date.now() })).toString('base64');
    return { token, email: res.email };
  }

  async authenticateSso(ssoToken: string): Promise<{ token: string; email: string }> {
    const verified = this.ssoService.verifyToken(ssoToken);
    const token = Buffer.from(JSON.stringify({ email: verified.email, ts: Date.now() })).toString('base64');
    return { token, email: verified.email };
  }

  // ---------------------------------------------------------------------------
  // Store Management
  // ---------------------------------------------------------------------------

  async getStore(mailboxEmail: string): Promise<MailboxStore> {
    const normalized = mailboxEmail.trim().toLowerCase();
    if (this.stores.has(normalized)) {
      const existing = this.stores.get(normalized)!;
      // Auto-sync if not synced in the last 10 seconds
      if (!existing.lastSyncedAt || Date.now() - existing.lastSyncedAt > 10000) {
        await this.syncFromMaildir(normalized, existing);
        existing.lastSyncedAt = Date.now();
      }
      return existing;
    }

    const store: MailboxStore = {
      threads: new Map(),
      messages: new Map(),
      lastSyncedAt: Date.now(),
    };

    const filePath = path.join(this.storageDir, `${this.sanitizeFilename(normalized)}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const json = JSON.parse(data);
      if (Array.isArray(json.messages)) {
        for (const msg of json.messages) {
          store.messages.set(msg.id, msg);
        }
      }
      if (Array.isArray(json.threads)) {
        for (const th of json.threads) {
          store.threads.set(th.id, th);
        }
      }
    } catch {}

    // Ingest physical messages
    await this.syncFromMaildir(normalized, store);

    // If still 0 messages, seed initial welcome message
    if (store.messages.size === 0) {
      this.seedInitialMessages(normalized, store);
    }

    await this.saveStore(normalized, store);
    this.stores.set(normalized, store);
    return store;
  }

  async syncFromMaildir(mailboxEmail: string, store: MailboxStore): Promise<void> {
    try {
      const folders: MailFolder[] = ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'];
      let changes = 0;

      for (const folder of folders) {
        const realMsgs = await this.storageService.readFolderMessages(mailboxEmail, folder);
        for (const msg of realMsgs) {
          if (!store.messages.has(msg.id)) {
            const normalizedSubject = this.normalizeSubject(msg.subject);
            let thread = Array.from(store.threads.values()).find(
              (t) =>
                this.normalizeSubject(t.subject).toLowerCase() === normalizedSubject.toLowerCase() ||
                (msg.inReplyTo && t.messages?.some((m) => m.messageIdHeader === msg.inReplyTo)),
            );

            const threadId = thread ? thread.id : randomUUID();
            msg.threadId = threadId;
            store.messages.set(msg.id, msg);
            changes++;

            if (thread) {
              thread.messageCount += 1;
              if (!msg.isRead) thread.unreadCount += 1;
              if (new Date(msg.date).getTime() > new Date(thread.lastMessageDate).getTime()) {
                thread.lastMessageDate = msg.date;
                thread.snippet = msg.snippet;
              }
              if (!thread.participants.some((p) => p.email === msg.from.email)) {
                thread.participants.push(msg.from);
              }
              if (msg.hasAttachments) thread.hasAttachments = true;
            } else {
              store.threads.set(threadId, {
                id: threadId,
                subject: msg.subject,
                snippet: msg.snippet,
                lastMessageDate: msg.date,
                messageCount: 1,
                unreadCount: msg.isRead ? 0 : 1,
                participants: [msg.from],
                folder: msg.folder,
                labels: msg.labels,
                hasAttachments: msg.hasAttachments,
                isStarred: msg.isStarred,
              });
            }
          } else {
            const existing = store.messages.get(msg.id)!;
            existing.filePath = msg.filePath;
            existing.fileOffset = msg.fileOffset;
          }
        }
      }

      if (changes > 0) {
        await this.saveStore(mailboxEmail, store);
      }
    } catch (err: any) {
      this.logger.warn(`Could not sync storage for ${mailboxEmail}: ${err.message}`);
    }
  }

  private async saveStore(mailboxEmail: string, store: MailboxStore): Promise<void> {
    const filePath = path.join(this.storageDir, `${this.sanitizeFilename(mailboxEmail)}.json`);
    const payload = {
      mailboxEmail,
      updatedAt: new Date().toISOString(),
      threads: Array.from(store.threads.values()),
      messages: Array.from(store.messages.values()),
    };
    try {
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.error(`Failed to save mail store for ${mailboxEmail}: ${err.message}`);
    }
  }

  private sanitizeFilename(input: string): string {
    return input.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  // ---------------------------------------------------------------------------
  // Demo Seed Data
  // ---------------------------------------------------------------------------

  private seedInitialMessages(mailboxEmail: string, store: MailboxStore) {
    const now = Date.now();
    const domain = mailboxEmail.split('@')[1] || 'clearpanel.local';

    const msg1Id = randomUUID();
    const th1Id = randomUUID();
    const msg1: EmailMessage = {
      id: msg1Id,
      threadId: th1Id,
      mailboxEmail,
      folder: 'inbox',
      labels: ['Important', 'System'],
      from: { name: 'ClearPanel Postmaster', email: `postmaster@${domain}` },
      to: [{ name: mailboxEmail.split('@')[0], email: mailboxEmail }],
      subject: 'Welcome to your ClearPanel Business Email',
      snippet: 'Your business mailbox is active. SPF, DKIM, and DMARC have been configured for maximum deliverability...',
      bodyHtml: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #202124;">
          <h2 style="color: #1a73e8;">Welcome to ClearPanel Business Email</h2>
          <p>Congratulations! Your business email on <strong>${domain}</strong> is fully set up and ready to use.</p>
          <div style="background-color: #f1f3f4; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h4 style="margin-top: 0; color: #137333;">✓ Deliverability Shield Active</h4>
            <ul style="margin-bottom: 0; padding-left: 20px;">
              <li><strong>SPF Record:</strong> Pass</li>
              <li><strong>DKIM 2048-bit Signature:</strong> Valid</li>
              <li><strong>DMARC Alignment:</strong> 100% Protected</li>
              <li><strong>TLS 1.3:</strong> In-transit encryption enabled</li>
            </ul>
          </div>
          <p>Enjoy lightning-fast email sync, conversation threading, attachments, and real-time push.</p>
          <p style="color: #5f6368; font-size: 13px;">— The ClearPanel Team</p>
        </div>
      `,
      bodyText: `Welcome to ClearPanel Business Email!\nYour business mailbox is active with full SPF, DKIM, and DMARC deliverability.`,
      isRead: false,
      isStarred: true,
      hasAttachments: false,
      security: {
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        tlsVersion: 'TLSv1.3',
        signedBy: domain,
      },
      date: new Date(now - 1000 * 60 * 15).toISOString(),
      size: 4096,
    };

    const th1: EmailThread = {
      id: th1Id,
      subject: msg1.subject,
      snippet: msg1.snippet,
      lastMessageDate: msg1.date,
      messageCount: 1,
      unreadCount: 1,
      participants: [msg1.from],
      folder: 'inbox',
      labels: msg1.labels,
      hasAttachments: false,
      isStarred: true,
    };

    store.messages.set(msg1Id, msg1);
    store.threads.set(th1Id, th1);
  }

  // ---------------------------------------------------------------------------
  // Thread Queries & Pagination
  // ---------------------------------------------------------------------------

  async getThreads(
    mailboxEmail: string,
    options: {
      folder?: MailFolder;
      label?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ threads: EmailThread[]; total: number; page: number; totalPages: number }> {
    const store = await this.getStore(mailboxEmail);
    const folder = options.folder || 'inbox';
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 50));

    let list = Array.from(store.threads.values());

    if (folder === 'starred') {
      list = list.filter((t) => t.isStarred);
    } else if (options.label) {
      list = list.filter((t) => t.labels.includes(options.label!));
    } else {
      list = list.filter((t) => t.folder === folder);
    }

    list.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);

    return {
      threads: paginated,
      total,
      page,
      totalPages,
    };
  }

  async getThreadById(mailboxEmail: string, threadId: string): Promise<EmailThread | null> {
    const store = await this.getStore(mailboxEmail);
    const thread = store.threads.get(threadId);
    if (!thread) return null;

    const msgs = Array.from(store.messages.values())
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      ...thread,
      messages: msgs,
    };
  }

  // ---------------------------------------------------------------------------
  // Optimistic Send & "Undo Send" Queue
  // ---------------------------------------------------------------------------

  async queueSend(
    mailboxEmail: string,
    payload: {
      to: EmailAddress[];
      cc?: EmailAddress[];
      bcc?: EmailAddress[];
      subject: string;
      bodyHtml?: string;
      bodyText?: string;
      attachments?: any[];
      replyToThreadId?: string;
      inReplyToMessageId?: string;
      undoGraceSeconds?: number;
    },
  ): Promise<{ pendingId: string; threadId: string; messageId: string; undoGraceSeconds: number }> {
    const store = await this.getStore(mailboxEmail);
    const graceSeconds = payload.undoGraceSeconds ?? 10;
    const messageId = randomUUID();
    const threadId = payload.replyToThreadId || randomUUID();
    const nowIso = new Date().toISOString();

    const fromAddress: EmailAddress = {
      name: mailboxEmail.split('@')[0],
      email: mailboxEmail,
    };

    const snippet = (payload.bodyText || payload.bodyHtml || '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/\s+/g, ' ')
      .slice(0, 140)
      .trim();

    const newMsg: EmailMessage = {
      id: messageId,
      threadId,
      mailboxEmail,
      folder: 'sent',
      labels: [],
      from: fromAddress,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      snippet,
      bodyHtml: payload.bodyHtml,
      bodyText: payload.bodyText,
      inReplyTo: payload.inReplyToMessageId,
      isRead: true,
      isStarred: false,
      hasAttachments: Boolean(payload.attachments && payload.attachments.length > 0),
      attachments: payload.attachments || [],
      date: nowIso,
      size: (payload.bodyHtml?.length || 0) + 1024,
    };

    store.messages.set(messageId, newMsg);

    let thread = store.threads.get(threadId);
    if (thread) {
      thread.snippet = snippet;
      thread.lastMessageDate = nowIso;
      thread.messageCount += 1;
      thread.folder = 'sent';
      if (!thread.participants.some((p) => p.email === fromAddress.email)) {
        thread.participants.push(fromAddress);
      }
    } else {
      thread = {
        id: threadId,
        subject: payload.subject,
        snippet,
        lastMessageDate: nowIso,
        messageCount: 1,
        unreadCount: 0,
        participants: [fromAddress, ...payload.to],
        folder: 'sent',
        labels: [],
        hasAttachments: newMsg.hasAttachments,
        isStarred: false,
      };
      store.threads.set(threadId, thread);
    }

    await this.saveStore(mailboxEmail, store);

    const pendingId = randomUUID();
    const sendAfter = Date.now() + graceSeconds * 1000;

    this.pendingSends.set(pendingId, {
      id: pendingId,
      mailboxEmail,
      message: newMsg,
      queuedAt: Date.now(),
      sendAfter,
      status: 'pending',
    });

    this.gateway.emitToMailbox(mailboxEmail, 'mail:optimistic_sent', {
      pendingId,
      threadId,
      message: newMsg,
      undoGraceSeconds: graceSeconds,
    });

    return {
      pendingId,
      threadId,
      messageId,
      undoGraceSeconds: graceSeconds,
    };
  }

  async cancelSend(mailboxEmail: string, pendingId: string): Promise<boolean> {
    const pending = this.pendingSends.get(pendingId);
    if (!pending || pending.mailboxEmail !== mailboxEmail) {
      return false;
    }

    if (pending.status !== 'pending') {
      return false;
    }

    pending.status = 'cancelled';
    this.pendingSends.delete(pendingId);

    const store = await this.getStore(mailboxEmail);
    const msg = store.messages.get(pending.message.id);
    if (msg) {
      msg.folder = 'drafts';
      await this.saveStore(mailboxEmail, store);
    }

    this.gateway.emitToMailbox(mailboxEmail, 'mail:send_cancelled', {
      pendingId,
      messageId: pending.message.id,
      draftRestored: true,
    });

    this.logger.log(`Undo Send executed for message ${pending.message.id}`);
    return true;
  }

  private async processPendingSends() {
    const now = Date.now();
    for (const [id, item] of this.pendingSends.entries()) {
      if (item.status === 'pending' && now >= item.sendAfter) {
        item.status = 'sending';
        try {
          await this.storageService.sendRealSmtp(item.mailboxEmail, {
            to: item.message.to,
            cc: item.message.cc,
            bcc: item.message.bcc,
            subject: item.message.subject,
            bodyHtml: item.message.bodyHtml,
            bodyText: item.message.bodyText,
            attachments: item.message.attachments,
            replyToMessageId: item.message.inReplyTo,
          });

          item.status = 'sent';
          this.logger.log(`Dispatched real SMTP email ${item.message.id} successfully.`);

          this.gateway.emitToMailbox(item.mailboxEmail, 'mail:send_completed', {
            pendingId: id,
            messageId: item.message.id,
          });
        } catch (err: any) {
          item.status = 'failed';
          item.error = err.message;
          this.logger.error(`Failed sending email ${item.message.id}: ${err.message}`);
          this.gateway.emitToMailbox(item.mailboxEmail, 'mail:send_failed', {
            pendingId: id,
            error: err.message,
          });
        } finally {
          this.pendingSends.delete(id);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Batch Thread Updates (Archive, Delete, Read/Unread, Star)
  // ---------------------------------------------------------------------------

  async batchUpdateThreads(
    mailboxEmail: string,
    threadIds: string[],
    updates: {
      markAsRead?: boolean;
      folder?: MailFolder;
      isStarred?: boolean;
      addLabels?: string[];
      removeLabels?: string[];
    },
  ): Promise<{ updatedCount: number }> {
    const store = await this.getStore(mailboxEmail);
    let count = 0;

    for (const tid of threadIds) {
      const thread = store.threads.get(tid);
      if (!thread) continue;

      if (updates.folder !== undefined) {
        thread.folder = updates.folder;
      }
      if (updates.isStarred !== undefined) {
        thread.isStarred = updates.isStarred;
      }
      if (updates.markAsRead !== undefined) {
        thread.unreadCount = updates.markAsRead ? 0 : 1;
      }
      if (updates.addLabels && updates.addLabels.length > 0) {
        thread.labels = Array.from(new Set([...thread.labels, ...updates.addLabels]));
      }
      if (updates.removeLabels && updates.removeLabels.length > 0) {
        thread.labels = thread.labels.filter((l) => !updates.removeLabels!.includes(l));
      }

      for (const msg of store.messages.values()) {
        if (msg.threadId === tid) {
          if (updates.folder !== undefined) msg.folder = updates.folder;
          if (updates.isStarred !== undefined) msg.isStarred = updates.isStarred;
          if (updates.markAsRead !== undefined) msg.isRead = updates.markAsRead;

          // Sync physical flags to Maildir
          this.storageService
            .updateMessagePhysicalFlags(msg, {
              markAsRead: updates.markAsRead,
              isStarred: updates.isStarred,
              targetFolder: updates.folder,
            })
            .catch(() => {});
        }
      }
      count++;
    }

    if (count > 0) {
      await this.saveStore(mailboxEmail, store);
      this.gateway.emitToMailbox(mailboxEmail, 'mail:threads_updated', {
        threadIds,
        updates,
      });
    }

    return { updatedCount: count };
  }

  // ---------------------------------------------------------------------------
  // Attachments & Contacts
  // ---------------------------------------------------------------------------

  async getAttachment(
    mailboxEmail: string,
    messageId: string,
    attachmentId: string,
  ): Promise<{ filename: string; mimeType: string; content: Buffer } | null> {
    const store = await this.getStore(mailboxEmail);
    const msg = store.messages.get(messageId);
    if (!msg) return null;
    return this.storageService.getAttachmentContent(msg, attachmentId);
  }

  async saveUploadedAttachment(file: any) {
    return this.storageService.saveUploadedFile(file);
  }

  async suggestContacts(
    mailboxEmail: string,
    query: string,
  ): Promise<{ name: string; email: string }[]> {
    const store = await this.getStore(mailboxEmail);
    const q = (query || '').trim().toLowerCase();
    const map = new Map<string, string>();

    for (const t of store.threads.values()) {
      for (const p of t.participants) {
        if (p.email && p.email.toLowerCase() !== mailboxEmail.toLowerCase()) {
          map.set(p.email.toLowerCase(), p.name || p.email.split('@')[0]);
        }
      }
    }

    const results: { name: string; email: string }[] = [];
    for (const [email, name] of map.entries()) {
      if (!q || email.includes(q) || name.toLowerCase().includes(q)) {
        results.push({ name, email });
      }
    }

    return results.slice(0, 15);
  }

  // ---------------------------------------------------------------------------
  // Inbound Webhook
  // ---------------------------------------------------------------------------

  async handleInboundDelivery(
    mailboxEmail: string,
    incoming: {
      from: EmailAddress;
      to: EmailAddress[];
      subject: string;
      bodyHtml?: string;
      bodyText?: string;
      attachments?: any[];
      headers?: Record<string, string>;
      security?: any;
    },
  ): Promise<{ threadId: string; messageId: string }> {
    const store = await this.getStore(mailboxEmail);
    const normalizedSubject = this.normalizeSubject(incoming.subject);
    const nowIso = new Date().toISOString();

    const existingThread = Array.from(store.threads.values()).find(
      (t) => this.normalizeSubject(t.subject).toLowerCase() === normalizedSubject.toLowerCase(),
    );

    const threadId = existingThread ? existingThread.id : randomUUID();
    const messageId = randomUUID();
    const snippet = (incoming.bodyText || incoming.bodyHtml || '')
      .replace(/<[^>]*>?/gm, '')
      .slice(0, 140)
      .trim();

    const newMsg: EmailMessage = {
      id: messageId,
      threadId,
      mailboxEmail,
      folder: 'inbox',
      labels: [],
      from: incoming.from,
      to: incoming.to,
      subject: incoming.subject,
      snippet,
      bodyHtml: incoming.bodyHtml,
      bodyText: incoming.bodyText,
      isRead: false,
      isStarred: false,
      hasAttachments: Boolean(incoming.attachments && incoming.attachments.length > 0),
      attachments: incoming.attachments || [],
      headers: incoming.headers || {},
      security: incoming.security || {
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        tlsVersion: 'TLSv1.3',
      },
      date: nowIso,
      size: (incoming.bodyHtml?.length || 0) + 2048,
    };

    store.messages.set(messageId, newMsg);

    if (existingThread) {
      existingThread.snippet = snippet;
      existingThread.lastMessageDate = nowIso;
      existingThread.messageCount += 1;
      existingThread.unreadCount += 1;
      existingThread.folder = 'inbox';
      if (!existingThread.participants.some((p) => p.email === incoming.from.email)) {
        existingThread.participants.push(incoming.from);
      }
      if (newMsg.hasAttachments) existingThread.hasAttachments = true;
    } else {
      const newThread: EmailThread = {
        id: threadId,
        subject: incoming.subject,
        snippet,
        lastMessageDate: nowIso,
        messageCount: 1,
        unreadCount: 1,
        participants: [incoming.from],
        folder: 'inbox',
        labels: [],
        hasAttachments: newMsg.hasAttachments,
        isStarred: false,
      };
      store.threads.set(threadId, newThread);
    }

    await this.saveStore(mailboxEmail, store);

    this.gateway.emitToMailbox(mailboxEmail, 'mail:new_incoming', {
      threadId,
      message: newMsg,
    });

    this.logger.log(`Pushed inbound email for ${mailboxEmail} (Thread: ${threadId})`);
    return { threadId, messageId };
  }

  // ---------------------------------------------------------------------------
  // Fast Full-Text Search
  // ---------------------------------------------------------------------------

  async search(
    mailboxEmail: string,
    query: string,
  ): Promise<{ threads: EmailThread[]; total: number }> {
    const store = await this.getStore(mailboxEmail);
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.getThreads(mailboxEmail);
    }

    const hasAttachmentFilter = q.includes('has:attachment');
    const isUnreadFilter = q.includes('is:unread');
    const isStarredFilter = q.includes('is:starred');

    const cleanQuery = q
      .replace(/has:attachment/g, '')
      .replace(/is:unread/g, '')
      .replace(/is:starred/g, '')
      .trim();

    const matchedThreads: EmailThread[] = [];

    for (const thread of store.threads.values()) {
      if (hasAttachmentFilter && !thread.hasAttachments) continue;
      if (isStarredFilter && !thread.isStarred) continue;
      if (isUnreadFilter && thread.unreadCount === 0) continue;

      if (!cleanQuery) {
        matchedThreads.push(thread);
        continue;
      }

      const subjectMatch = thread.subject.toLowerCase().includes(cleanQuery);
      const snippetMatch = thread.snippet.toLowerCase().includes(cleanQuery);
      const participantMatch = thread.participants.some(
        (p) => p.name.toLowerCase().includes(cleanQuery) || p.email.toLowerCase().includes(cleanQuery),
      );

      let bodyMatch = false;
      if (!subjectMatch && !snippetMatch && !participantMatch) {
        for (const msg of store.messages.values()) {
          if (msg.threadId === thread.id) {
            if (
              (msg.bodyText && msg.bodyText.toLowerCase().includes(cleanQuery)) ||
              (msg.bodyHtml && msg.bodyHtml.toLowerCase().includes(cleanQuery))
            ) {
              bodyMatch = true;
              break;
            }
          }
        }
      }

      if (subjectMatch || snippetMatch || participantMatch || bodyMatch) {
        matchedThreads.push(thread);
      }
    }

    matchedThreads.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());

    return {
      threads: matchedThreads,
      total: matchedThreads.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  async getStats(mailboxEmail: string): Promise<MailboxStats> {
    const store = await this.getStore(mailboxEmail);
    let unreadCount = 0;
    let usedBytes = 0;
    const foldersCount: Record<MailFolder, number> = {
      inbox: 0,
      sent: 0,
      drafts: 0,
      trash: 0,
      spam: 0,
      starred: 0,
      archive: 0,
    };

    for (const t of store.threads.values()) {
      if (t.unreadCount > 0) unreadCount += t.unreadCount;
      if (t.folder in foldersCount) {
        foldersCount[t.folder]++;
      }
      if (t.isStarred) {
        foldersCount.starred++;
      }
    }

    for (const m of store.messages.values()) {
      usedBytes += m.size || 2048;
    }

    return {
      mailboxEmail,
      unreadCount,
      totalThreads: store.threads.size,
      usedBytes,
      quotaBytes: 15 * 1024 * 1024 * 1024,
      foldersCount,
    };
  }
}
