import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  forwardRef,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
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
import { MailService } from '../mail.service';

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
    @Inject(forwardRef(() => MailService))
    private readonly mailService: MailService,
  ) {}

  async getMailboxProfile(mailboxEmail: string): Promise<{ email: string; name?: string; avatarUrl?: string }> {
    const cleanEmail = mailboxEmail.toLowerCase().trim();
    const domains = await this.mailService.readDomains();
    for (const d of domains) {
      const mb = (d.mailboxes || []).find((m: any) => m.email.toLowerCase() === cleanEmail);
      if (mb) {
        return {
          email: cleanEmail,
          name: mb.name,
          avatarUrl: mb.avatarUrl || `/api/mail/avatars/${encodeURIComponent(cleanEmail)}`,
        };
      }
    }
    return {
      email: cleanEmail,
      avatarUrl: `/api/mail/avatars/${encodeURIComponent(cleanEmail)}`,
    };
  }

  async updateMailboxProfile(
    mailboxEmail: string,
    name?: string,
    file?: any,
  ): Promise<{ success: boolean; email: string; name?: string; avatarUrl: string }> {
    const res = await this.mailService.saveMailboxAvatarByEmail(mailboxEmail, file, name);
    return {
      success: true,
      email: mailboxEmail,
      name: res.name,
      avatarUrl: res.avatarUrl,
    };
  }

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
      const res = await this.syncFromMaildir(mailboxEmail, store);
      if (res.changed) {
        this.gateway.emitToMailbox(mailboxEmail, 'mail:store_refreshed', {
          mailboxEmail,
          totalMessages: store.messages.size,
          totalThreads: store.threads.size,
        });
      }
    }
  }

  async forceRefreshMailbox(mailboxEmail: string): Promise<{ success: boolean; mailboxEmail: string; totalMessages: number; totalThreads: number }> {
    const normalized = mailboxEmail.trim().toLowerCase();
    const store = await this.getStore(normalized);
    const res = await this.syncFromMaildir(normalized, store);
    store.lastSyncedAt = Date.now();
    await this.saveStore(normalized, store);
    this.gateway.emitToMailbox(normalized, 'mail:store_refreshed', {
      mailboxEmail: normalized,
      totalMessages: store.messages.size,
      totalThreads: store.threads.size,
    });
    return {
      success: true,
      mailboxEmail: normalized,
      totalMessages: store.messages.size,
      totalThreads: store.threads.size,
    };
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
      throw new UnauthorizedException('Invalid email address or password');
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

    // Ingest physical messages from Maildir and mbox
    await this.syncFromMaildir(normalized, store);

    // Clean up any historical duplicate messages or threads
    this.deduplicateStore(store);

    await this.saveStore(normalized, store);
    this.stores.set(normalized, store);
    return store;
  }

  private deduplicateStore(store: MailboxStore): boolean {
    let changed = false;
    const cleanMsgId = (id?: string) => (id ? id.replace(/^<+|>+$/g, '').trim().toLowerCase() : '');

    // 1. Deduplicate messages
    const messages = Array.from(store.messages.values());
    const toRemove = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const m1 = messages[i];
      if (toRemove.has(m1.id)) continue;

      for (let j = i + 1; j < messages.length; j++) {
        const m2 = messages[j];
        if (toRemove.has(m2.id)) continue;

        if (m1.folder !== m2.folder) continue;

        let isDuplicate = false;

        // Check A: Same messageIdHeader
        if (m1.messageIdHeader && m2.messageIdHeader && cleanMsgId(m1.messageIdHeader) === cleanMsgId(m2.messageIdHeader)) {
          isDuplicate = true;
        }

        // Check B: Sent folder matching (optimistic UUID + disk file sync)
        if (!isDuplicate && m1.folder === 'sent') {
          const sub1 = this.normalizeSubject(m1.subject).toLowerCase();
          const sub2 = this.normalizeSubject(m2.subject).toLowerCase();
          const to1 = m1.to?.[0]?.email?.toLowerCase() || '';
          const to2 = m2.to?.[0]?.email?.toLowerCase() || '';
          const timeDiff = Math.abs(new Date(m1.date).getTime() - new Date(m2.date).getTime());

          if (sub1 === sub2 && to1 === to2 && timeDiff < 300000) {
            isDuplicate = true;
          }
        }

        if (isDuplicate) {
          // Keep the message with filePath / fuller data
          const keepM1 = Boolean(m1.filePath) || (!m2.filePath && Boolean(m1.messageIdHeader));
          const survivor = keepM1 ? m1 : m2;
          const victim = keepM1 ? m2 : m1;

          survivor.filePath = survivor.filePath || victim.filePath;
          survivor.fileOffset = survivor.fileOffset ?? victim.fileOffset;
          survivor.messageIdHeader = survivor.messageIdHeader || victim.messageIdHeader;
          survivor.bodyHtml = survivor.bodyHtml || victim.bodyHtml;
          survivor.bodyText = survivor.bodyText || victim.bodyText;
          survivor.security = survivor.security || victim.security;
          survivor.attachments = (survivor.attachments && survivor.attachments.length > 0) ? survivor.attachments : victim.attachments;

          toRemove.add(victim.id);
          changed = true;
        }
      }
    }

    if (toRemove.size > 0) {
      for (const victimId of toRemove) {
        store.messages.delete(victimId);
      }
    }

    // 2. Deduplicate and merge threads with identical normalized subjects, same folder and participants
    const threads = Array.from(store.threads.values());
    const threadsToRemove = new Set<string>();

    for (let i = 0; i < threads.length; i++) {
      const t1 = threads[i];
      if (threadsToRemove.has(t1.id)) continue;

      const normSub1 = this.normalizeSubject(t1.subject).toLowerCase();
      if (!normSub1 || normSub1 === '(no subject)') continue;

      for (let j = i + 1; j < threads.length; j++) {
        const t2 = threads[j];
        if (threadsToRemove.has(t2.id)) continue;
        if (t1.folder !== t2.folder) continue;

        const normSub2 = this.normalizeSubject(t2.subject).toLowerCase();
        if (normSub1 === normSub2) {
          const p1 = t1.participants.map((p) => p.email.toLowerCase()).sort().join(',');
          const p2 = t2.participants.map((p) => p.email.toLowerCase()).sort().join(',');
          if (p1 === p2) {
            for (const msg of store.messages.values()) {
              if (msg.threadId === t2.id) {
                msg.threadId = t1.id;
              }
            }
            threadsToRemove.add(t2.id);
            changed = true;
          }
        }
      }
    }

    if (threadsToRemove.size > 0) {
      for (const thId of threadsToRemove) {
        store.threads.delete(thId);
      }
    }

    // 3. Recalculate messageCount, unreadCount, and lastMessageDate for all threads
    for (const [threadId, thread] of store.threads.entries()) {
      const threadMsgs = Array.from(store.messages.values())
        .filter((m) => m.threadId === threadId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (threadMsgs.length === 0) {
        store.threads.delete(threadId);
        changed = true;
      } else {
        const prevCount = thread.messageCount;
        thread.messageCount = threadMsgs.length;
        thread.unreadCount = threadMsgs.filter((m) => !m.isRead).length;
        const latest = threadMsgs[threadMsgs.length - 1];
        thread.lastMessageDate = latest.date;
        thread.snippet = latest.snippet || thread.snippet;
        if (thread.messageCount !== prevCount) {
          changed = true;
        }
      }
    }

    return changed;
  }

  async syncFromMaildir(mailboxEmail: string, store: MailboxStore): Promise<{ changed: boolean; addedCount: number }> {
    try {
      const folders: MailFolder[] = ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'];
      let changes = 0;
      const cleanMsgId = (id?: string) => (id ? id.replace(/^<+|>+$/g, '').trim().toLowerCase() : '');

      for (const folder of folders) {
        const realMsgs = await this.storageService.readFolderMessages(mailboxEmail, folder);
        for (const msg of realMsgs) {
          // Check if this physical message is already in store.messages
          let existing = store.messages.get(msg.id);
          if (!existing && msg.messageIdHeader) {
            const targetId = cleanMsgId(msg.messageIdHeader);
            existing = Array.from(store.messages.values()).find(
              (m) => cleanMsgId(m.messageIdHeader) === targetId,
            );
          }

          if (!existing && folder === 'sent') {
            const normSub = this.normalizeSubject(msg.subject).toLowerCase();
            const targetTo = msg.to?.[0]?.email?.toLowerCase() || '';
            const msgTime = new Date(msg.date).getTime();

            existing = Array.from(store.messages.values()).find((m) => {
              if (m.folder !== 'sent') return false;
              if (this.normalizeSubject(m.subject).toLowerCase() !== normSub) return false;
              const mTo = m.to?.[0]?.email?.toLowerCase() || '';
              if (mTo !== targetTo) return false;
              const timeDiff = Math.abs(new Date(m.date).getTime() - msgTime);
              return timeDiff < 300000;
            });
          }

          if (existing) {
            // Already tracked, update physical properties
            existing.filePath = msg.filePath || existing.filePath;
            existing.fileOffset = msg.fileOffset ?? existing.fileOffset;
            if (!existing.messageIdHeader && msg.messageIdHeader) {
              existing.messageIdHeader = msg.messageIdHeader;
            }
            if (!existing.bodyHtml && msg.bodyHtml) {
              existing.bodyHtml = msg.bodyHtml;
            }
            if (!existing.bodyText && msg.bodyText) {
              existing.bodyText = msg.bodyText;
            }
            if (msg.security) {
              existing.security = msg.security;
            }
            continue;
          }

          // Truly new message from disk
          const normalizedSubject = this.normalizeSubject(msg.subject);
          const isGeneric = !normalizedSubject || normalizedSubject.toLowerCase() === '(no subject)';

          let thread: EmailThread | undefined;
          if (msg.inReplyTo) {
            const cleanInReplyTo = cleanMsgId(msg.inReplyTo);
            thread = Array.from(store.threads.values()).find((t) =>
              Array.from(store.messages.values()).some(
                (m) => m.threadId === t.id && cleanMsgId(m.messageIdHeader) === cleanInReplyTo,
              ),
            );
          }

          if (!thread && !isGeneric) {
            thread = Array.from(store.threads.values()).find((t) => {
              if (this.normalizeSubject(t.subject).toLowerCase() !== normalizedSubject.toLowerCase()) {
                return false;
              }
              const msgSender = msg.from?.email?.toLowerCase();
              const msgRecipients = (msg.to || []).map((x) => x.email.toLowerCase());
              const threadParticipants = t.participants.map((p) => p.email.toLowerCase());
              return (
                (msgSender && threadParticipants.includes(msgSender)) ||
                msgRecipients.some((r) => threadParticipants.includes(r))
              );
            });
          }

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
            if (msg.folder === 'inbox' && thread.folder !== 'trash' && thread.folder !== 'spam') {
              thread.folder = 'inbox';
            }
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
        }
      }

      if (this.deduplicateStore(store)) {
        changes++;
      }

      if (changes > 0) {
        await this.saveStore(mailboxEmail, store);
      }
      return { changed: changes > 0, addedCount: changes };
    } catch (err: any) {
      this.logger.warn(`Could not sync storage for ${mailboxEmail}: ${err.message}`);
      return { changed: false, addedCount: 0 };
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
    } else if (folder === 'inbox') {
      list = list.filter((t) => {
        if (t.folder === 'trash' || t.folder === 'spam' || t.folder === 'archive') return false;
        if (t.folder === 'inbox') return true;
        return Array.from(store.messages.values()).some((m) => m.threadId === t.id && m.folder === 'inbox');
      });
    } else if (folder === 'sent') {
      list = list.filter((t) => {
        if (t.folder === 'trash' || t.folder === 'spam') return false;
        if (t.folder === 'sent') return true;
        return Array.from(store.messages.values()).some((m) => m.threadId === t.id && m.folder === 'sent');
      });
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
    const domain = mailboxEmail.split('@')[1] || 'mail';
    const messageIdHeader = `<${randomUUID()}@${domain}>`;

    const fromAddress: EmailAddress = {
      name: mailboxEmail.split('@')[0],
      email: mailboxEmail,
    };

    const snippet = (payload.bodyText || payload.bodyHtml || '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/\s+/g, ' ')
      .slice(0, 140)
      .trim();

    let inReplyToHeader: string | undefined = payload.inReplyToMessageId;
    let references: string[] | undefined = undefined;

    if (payload.inReplyToMessageId) {
      const cleanTarget = payload.inReplyToMessageId.replace(/^<+|>+$/g, '').trim().toLowerCase();
      const parentMsg = store.messages.get(payload.inReplyToMessageId) ||
        Array.from(store.messages.values()).find(
          (m) => m.id === payload.inReplyToMessageId || (m.messageIdHeader && m.messageIdHeader.replace(/^<+|>+$/g, '').trim().toLowerCase() === cleanTarget),
        );
      if (parentMsg && parentMsg.messageIdHeader) {
        inReplyToHeader = parentMsg.messageIdHeader;
        references = [...(parentMsg.references || []), parentMsg.messageIdHeader];
      } else if (payload.inReplyToMessageId) {
        inReplyToHeader = payload.inReplyToMessageId.startsWith('<') ? payload.inReplyToMessageId : `<${payload.inReplyToMessageId}>`;
        references = [inReplyToHeader];
      }
    }

    const newMsg: EmailMessage = {
      id: messageId,
      threadId,
      mailboxEmail,
      messageIdHeader,
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
      inReplyTo: inReplyToHeader,
      references,
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
      if (!thread.folder || thread.folder === 'drafts') {
        thread.folder = 'sent';
      }
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
          const sentResult = await this.storageService.sendRealSmtp(item.mailboxEmail, {
            to: item.message.to,
            cc: item.message.cc,
            bcc: item.message.bcc,
            subject: item.message.subject,
            bodyHtml: item.message.bodyHtml,
            bodyText: item.message.bodyText,
            attachments: item.message.attachments,
            replyToMessageId: item.message.inReplyTo,
            references: item.message.references,
            messageIdHeader: item.message.messageIdHeader,
          });

          item.status = 'sent';
          this.logger.log(`Dispatched real SMTP email ${item.message.id} successfully.`);

          // Link physical file and final messageIdHeader to stored message
          const store = await this.getStore(item.mailboxEmail);
          const storedMsg = store.messages.get(item.message.id);
          if (storedMsg && sentResult) {
            if (sentResult.filePath) storedMsg.filePath = sentResult.filePath;
            if (sentResult.messageIdHeader) storedMsg.messageIdHeader = sentResult.messageIdHeader;
            await this.saveStore(item.mailboxEmail, store);
          }

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

    const allMessages = Array.from(store.messages.values());

    for (const t of store.threads.values()) {
      if (t.unreadCount > 0) unreadCount += t.unreadCount;
      if (t.isStarred) foldersCount.starred++;

      if (t.folder === 'trash') {
        foldersCount.trash++;
        continue;
      }
      if (t.folder === 'spam') {
        foldersCount.spam++;
        continue;
      }
      if (t.folder === 'drafts') {
        foldersCount.drafts++;
        continue;
      }

      // Check inbox presence
      const hasInbox = t.folder === 'inbox' || allMessages.some((m) => m.threadId === t.id && m.folder === 'inbox');
      if (hasInbox && t.folder !== 'archive') {
        foldersCount.inbox++;
      }

      // Check sent presence
      const hasSent = t.folder === 'sent' || allMessages.some((m) => m.threadId === t.id && m.folder === 'sent');
      if (hasSent) {
        foldersCount.sent++;
      }

      if (t.folder === 'archive') {
        foldersCount.archive++;
      }
    }

    for (const m of store.messages.values()) {
      usedBytes += m.size || 2048;
    }

    let quotaMb = 1024; // Default 1GB
    try {
      const data = await fs.readFile(getDataFilePath('mail-domains.json'), 'utf8');
      const domains = JSON.parse(data);
      if (Array.isArray(domains)) {
        for (const dom of domains) {
          if (Array.isArray(dom.mailboxes)) {
            const found = dom.mailboxes.find(
              (m: any) => m.email && m.email.trim().toLowerCase() === mailboxEmail.trim().toLowerCase(),
            );
            if (found && typeof found.quotaMb === 'number' && found.quotaMb > 0) {
              quotaMb = found.quotaMb;
              break;
            }
          }
        }
      }
    } catch {}

    return {
      mailboxEmail,
      unreadCount,
      totalThreads: store.threads.size,
      usedBytes,
      quotaBytes: quotaMb * 1024 * 1024,
      foldersCount,
    };
  }
}
