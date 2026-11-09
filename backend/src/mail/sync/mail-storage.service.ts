import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID, createHash } from 'crypto';
import { exec, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { simpleParser, ParsedMail } from 'mailparser';
import * as nodemailer from 'nodemailer';
import {
  EmailMessage,
  EmailAddress,
  EmailAttachment,
  MailFolder,
  EmailSecurityStatus,
} from './mail-sync.model';
import { getDataFilePath } from '../../common/paths';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

@Injectable()
export class MailStorageService {
  private readonly logger = new Logger(MailStorageService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;
  private readonly uploadDir = '/tmp/clearmail-uploads';

  constructor() {
    this.initSmtp();
    this.initUploadDir();
  }

  private initSmtp() {
    this.smtpTransporter = nodemailer.createTransport({
      host: '127.0.0.1',
      port: 25,
      secure: false,
      ignoreTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  private async initUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Path Resolution
  // ---------------------------------------------------------------------------

  getMaildirRoot(mailboxEmail: string): string {
    const parts = mailboxEmail.trim().toLowerCase().split('@');
    const userPart = parts[0] || 'user';
    const domain = parts[1] || 'domain';
    return path.join('/var/mail/vhosts', domain, userPart);
  }

  getMboxInboxPath(mailboxEmail: string): string {
    return path.join('/var/mail', mailboxEmail.trim().toLowerCase());
  }

  async getEffectiveMaildir(mailboxEmail: string): Promise<string> {
    const prodPath = this.getMaildirRoot(mailboxEmail);
    try {
      await fs.access(prodPath);
      return prodPath;
    } catch {
      const parts = mailboxEmail.trim().toLowerCase().split('@');
      const devPath = getDataFilePath(path.join('vmail', parts[1] || 'domain', parts[0] || 'user'));
      await fs.mkdir(path.join(devPath, 'cur'), { recursive: true });
      await fs.mkdir(path.join(devPath, 'new'), { recursive: true });
      await fs.mkdir(path.join(devPath, '.Sent', 'cur'), { recursive: true });
      await fs.mkdir(path.join(devPath, '.Drafts', 'cur'), { recursive: true });
      await fs.mkdir(path.join(devPath, '.Trash', 'cur'), { recursive: true });
      await fs.mkdir(path.join(devPath, '.Junk', 'cur'), { recursive: true });
      return devPath;
    }
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  async verifyCredentials(email: string, password: string): Promise<{ valid: boolean; email: string }> {
    const normalized = email.trim().toLowerCase();

    // 1. Try doveadm auth test via sudo
    try {
      const { stdout } = await execFileAsync('sudo', ['/usr/bin/doveadm', 'auth', 'test', normalized, password]);
      if (stdout.includes('auth succeeded') || stdout.includes('auth successful')) {
        return { valid: true, email: normalized };
      }
    } catch {}

    // Also try doveadm directly without sudo if available
    try {
      const { stdout } = await execFileAsync('doveadm', ['auth', 'test', normalized, password]);
      if (stdout.includes('auth succeeded') || stdout.includes('auth successful')) {
        return { valid: true, email: normalized };
      }
    } catch {}

    // 2. Collect candidate password hashes from mail-domains.json, dovecot-users, and passwd
    const candidateHashes: string[] = [];

    // Check mail-domains.json
    try {
      const raw = await fs.readFile(getDataFilePath('mail-domains.json'), 'utf8');
      const domains = JSON.parse(raw);
      for (const d of domains) {
        for (const mb of (d.mailboxes || [])) {
          if (mb.email && mb.email.toLowerCase().trim() === normalized && mb.passwordHash) {
            candidateHashes.push(mb.passwordHash.trim());
          }
        }
      }
    } catch {}

    // Check /etc/clearpanel/mail/dovecot-users and /etc/clearpanel/mail/passwd
    const userFiles = ['/etc/clearpanel/mail/dovecot-users', '/etc/clearpanel/mail/passwd'];
    for (const filePath of userFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const parts = line.split(':');
          if (parts[0] && parts[0].trim().toLowerCase() === normalized) {
            const passHash = parts[1]?.trim();
            if (passHash) {
              candidateHashes.push(passHash);
            }
          }
        }
      } catch {}
    }

    // 3. Test candidate hashes
    for (const passHash of candidateHashes) {
      if (passHash.startsWith('{PLAIN}')) {
        if (passHash.replace('{PLAIN}', '') === password) {
          return { valid: true, email: normalized };
        }
      }

      if (!passHash.startsWith('$') && !passHash.startsWith('{') && passHash === password) {
        return { valid: true, email: normalized };
      }

      // Test scheme prefix with sudo doveadm pw -t
      const schemeHash = passHash.startsWith('{') ? passHash : `{SHA512-CRYPT}${passHash}`;
      try {
        await execFileAsync('sudo', ['/usr/bin/doveadm', 'pw', '-t', schemeHash, '-p', password]);
        return { valid: true, email: normalized };
      } catch {}

      // Test Unix crypt ($6$ SHA-512) via openssl
      const rawHash = passHash.replace(/^\{[A-Z0-9-]+\}/i, '');
      const saltMatch = rawHash.match(/^\$6\$([^$]+)\$/);
      if (saltMatch) {
        const salt = saltMatch[1];
        try {
          const matched = await new Promise<boolean>((resolve) => {
            const proc = spawn('openssl', ['passwd', '-6', '-salt', salt, '-stdin']);
            let out = '';
            proc.stdout.on('data', (d) => (out += d));
            proc.on('close', (code) => resolve(code === 0 && out.trim() === rawHash));
            proc.on('error', () => resolve(false));
            proc.stdin.write(password);
            proc.stdin.end();
          });
          if (matched) {
            return { valid: true, email: normalized };
          }
        } catch {}
      }

      // Python3 crypt fallback
      try {
        await execFileAsync('python3', [
          '-c',
          'import crypt, sys; sys.exit(0 if crypt.crypt(sys.argv[1], sys.argv[2]) == sys.argv[2] else 1)',
          password,
          rawHash,
        ]);
        return { valid: true, email: normalized };
      } catch {}
    }

    return { valid: false, email: normalized };
  }

  // ---------------------------------------------------------------------------
  // Read Messages from Maildir and Mbox
  // ---------------------------------------------------------------------------

  async readFolderMessages(mailboxEmail: string, folder: MailFolder): Promise<EmailMessage[]> {
    const messages: EmailMessage[] = [];
    const maildir = await this.getEffectiveMaildir(mailboxEmail);
    const mboxInbox = this.getMboxInboxPath(mailboxEmail);

    // 1. Check Maildir subdirectories
    const maildirDirs: string[] = [];
    switch (folder) {
      case 'inbox':
        maildirDirs.push(path.join(maildir, 'new'), path.join(maildir, 'cur'));
        break;
      case 'sent':
        maildirDirs.push(path.join(maildir, '.Sent', 'cur'), path.join(maildir, '.Sent', 'new'));
        break;
      case 'drafts':
        maildirDirs.push(path.join(maildir, '.Drafts', 'cur'), path.join(maildir, '.Drafts', 'new'));
        break;
      case 'trash':
        maildirDirs.push(path.join(maildir, '.Trash', 'cur'), path.join(maildir, '.Trash', 'new'));
        break;
      case 'spam':
        maildirDirs.push(path.join(maildir, '.Junk', 'cur'), path.join(maildir, '.Junk', 'new'));
        break;
      case 'archive':
        maildirDirs.push(path.join(maildir, '.Archive', 'cur'), path.join(maildir, '.Archive', 'new'));
        break;
      default:
        maildirDirs.push(path.join(maildir, 'cur'));
    }

    for (const dir of maildirDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const filePath = path.join(dir, file);
          try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile()) continue;

            const buffer = await fs.readFile(filePath);
            const parsed = await simpleParser(buffer);

            const isSeen = file.includes(':2,') ? file.split(':2,')[1].includes('S') : dir.endsWith('cur');
            const isFlagged = file.includes(':2,') ? file.split(':2,')[1].includes('F') : false;

            const msg = this.convertParsedMail(
              parsed,
              file,
              mailboxEmail,
              folder,
              isSeen,
              isFlagged,
              stat.size,
              stat.mtime,
              filePath,
            );
            messages.push(msg);
          } catch (err: any) {
            this.logger.warn(`Could not parse Maildir message ${filePath}: ${err.message}`);
          }
        }
      } catch {}
    }

    // 2. Check Dovecot mbox storage files
    const mboxFiles: { path: string; folder: MailFolder }[] = [];
    if (folder === 'inbox') {
      mboxFiles.push({ path: mboxInbox, folder: 'inbox' });
    } else if (folder === 'sent') {
      mboxFiles.push({ path: path.join(maildir, 'mail', 'Sent'), folder: 'sent' });
    } else if (folder === 'trash') {
      mboxFiles.push({ path: path.join(maildir, 'mail', 'Trash'), folder: 'trash' });
    } else if (folder === 'drafts') {
      mboxFiles.push({ path: path.join(maildir, 'mail', 'Drafts'), folder: 'drafts' });
    } else if (folder === 'spam') {
      mboxFiles.push({ path: path.join(maildir, 'mail', 'Junk'), folder: 'spam' });
    }

    for (const item of mboxFiles) {
      try {
        const stat = await fs.stat(item.path);
        if (stat.isFile() && stat.size > 0) {
          const rawMbox = await fs.readFile(item.path, 'utf8');
          const chunks = this.splitMbox(rawMbox);

          for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            if (!chunk.trim()) continue;
            try {
              const buffer = Buffer.from(chunk, 'utf8');
              const parsed = await simpleParser(buffer);
              const mboxMsgId = `mbox_${idx}_${this.hashString(parsed.messageId || chunk.slice(0, 80))}`;

              // Determine flags if Status: or X-Status: headers exist
              const statusHeader = (parsed.headers.get('status') as string) || '';
              const xStatusHeader = (parsed.headers.get('x-status') as string) || '';
              const isSeen = statusHeader.includes('R') || statusHeader.includes('O') || item.folder === 'sent';
              const isFlagged = xStatusHeader.includes('F');

              const msg = this.convertParsedMail(
                parsed,
                mboxMsgId,
                mailboxEmail,
                item.folder,
                isSeen,
                isFlagged,
                buffer.length,
                stat.mtime,
                item.path,
                idx,
              );
              messages.push(msg);
            } catch (err: any) {
              this.logger.warn(`Could not parse mbox chunk ${idx} from ${item.path}: ${err.message}`);
            }
          }
        }
      } catch {}
    }

    return messages;
  }

  private splitMbox(content: string): string[] {
    const lines = content.split(/\r?\n/);
    const messages: string[] = [];
    let current: string[] = [];

    for (const line of lines) {
      if (line.startsWith('From ') && current.length > 0) {
        messages.push(current.join('\n'));
        current = [];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0 && current.some((l) => l.trim().length > 0)) {
      messages.push(current.join('\n'));
    }
    return messages;
  }

  private convertParsedMail(
    parsed: ParsedMail,
    fallbackId: string,
    mailboxEmail: string,
    folder: MailFolder,
    isSeen: boolean,
    isFlagged: boolean,
    fileSize: number,
    fileMtime: Date,
    filePath?: string,
    fileOffset?: number,
  ): EmailMessage {
    const xAvatar = (parsed.headers?.get('x-avatar-url') as string) ||
                    (parsed.headers?.get('x-image-url') as string) ||
                    (parsed.headers?.get('image-url') as string) ||
                    (parsed.headers?.get('x-sender-avatar') as string);
    const parsedFrom = parsed.from?.value[0];
    const fromAddr: EmailAddress = parsedFrom
      ? {
          name: parsedFrom.name || '',
          email: parsedFrom.address || '',
          avatarUrl: xAvatar || (parsedFrom.address ? `/api/mail/avatars/${encodeURIComponent(parsedFrom.address)}` : undefined),
        }
      : {
          name: 'Unknown',
          email: 'unknown@domain.com',
          avatarUrl: '/api/mail/avatars/unknown%40domain.com',
        };

    const toAddrs: EmailAddress[] = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
      .flatMap((entry: any) => entry.value || [])
      .map((a: any) => ({ name: a.name || '', email: a.address || '' }));

    const ccAddrs: EmailAddress[] = (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
      .flatMap((entry: any) => entry.value || [])
      .map((a: any) => ({ name: a.name || '', email: a.address || '' }));

    const bccAddrs: EmailAddress[] = (parsed.bcc ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]) : [])
      .flatMap((entry: any) => entry.value || [])
      .map((a: any) => ({ name: a.name || '', email: a.address || '' }));

    const snippet = (parsed.text || parsed.html || '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/\s+/g, ' ')
      .slice(0, 140)
      .trim();

    const attachments: EmailAttachment[] = (parsed.attachments || []).map((att: any, idx: number) => ({
      id: att.cid || `att_${idx}_${randomUUID()}`,
      filename: att.filename || `attachment_${idx}`,
      mimeType: att.contentType || 'application/octet-stream',
      size: att.size || att.content?.length || 0,
      contentId: att.cid,
    }));

    const authResults = (parsed.headers.get('authentication-results') as string) || '';
    const dkimHeader = (parsed.headers.get('dkim-signature') as string) || '';
    const spfHeader = (parsed.headers.get('received-spf') as string) || '';

    const security: EmailSecurityStatus = {
      spf: spfHeader.includes('pass') || authResults.includes('spf=pass') ? 'pass' : 'neutral',
      dkim: dkimHeader || authResults.includes('dkim=pass') ? 'pass' : 'none',
      dmarc: authResults.includes('dmarc=pass') ? 'pass' : 'none',
      tlsVersion: 'TLSv1.3',
      signedBy: fromAddr.email.split('@')[1],
    };

    const dateIso = parsed.date ? parsed.date.toISOString() : fileMtime.toISOString();
    const id = parsed.messageId ? this.sanitizeId(parsed.messageId) : this.sanitizeId(fallbackId);

    return {
      id,
      threadId: '',
      mailboxEmail,
      messageIdHeader: parsed.messageId,
      inReplyTo: typeof parsed.inReplyTo === 'string' ? parsed.inReplyTo : undefined,
      references: typeof parsed.references === 'string' ? [parsed.references] : (parsed.references as string[]),
      folder,
      labels: [],
      from: fromAddr,
      to: toAddrs,
      cc: ccAddrs,
      bcc: bccAddrs,
      subject: parsed.subject || '(No Subject)',
      snippet,
      bodyHtml: parsed.html || undefined,
      bodyText: parsed.text || undefined,
      isRead: isSeen,
      isStarred: isFlagged,
      hasAttachments: attachments.length > 0,
      attachments,
      security,
      date: dateIso,
      size: fileSize,
      filePath,
      fileOffset,
    };
  }

  // ---------------------------------------------------------------------------
  // Physical Flag Updating & File Moving
  // ---------------------------------------------------------------------------

  async updateMessagePhysicalFlags(
    msg: EmailMessage,
    updates: {
      markAsRead?: boolean;
      isStarred?: boolean;
      targetFolder?: MailFolder;
    },
  ): Promise<void> {
    if (!msg.filePath) return;

    // Maildir file renaming
    if (msg.filePath.includes('/cur/') || msg.filePath.includes('/new/')) {
      try {
        const dir = path.dirname(msg.filePath);
        const filename = path.basename(msg.filePath);

        let baseName = filename;
        let flags = '';
        if (filename.includes(':2,')) {
          const parts = filename.split(':2,');
          baseName = parts[0];
          flags = parts[1] || '';
        }

        let flagsSet = new Set(flags.split(''));
        if (updates.markAsRead === true) flagsSet.add('S');
        if (updates.markAsRead === false) flagsSet.delete('S');
        if (updates.isStarred === true) flagsSet.add('F');
        if (updates.isStarred === false) flagsSet.delete('F');

        const newFlags = Array.from(flagsSet).sort().join('');
        const newFilename = `${baseName}:2,${newFlags}`;

        let targetDir = dir;
        if (updates.targetFolder) {
          const maildir = await this.getEffectiveMaildir(msg.mailboxEmail);
          switch (updates.targetFolder) {
            case 'trash':
              targetDir = path.join(maildir, '.Trash', 'cur');
              break;
            case 'archive':
              targetDir = path.join(maildir, '.Archive', 'cur');
              break;
            case 'spam':
              targetDir = path.join(maildir, '.Junk', 'cur');
              break;
            case 'inbox':
              targetDir = path.join(maildir, 'cur');
              break;
          }
          await fs.mkdir(targetDir, { recursive: true });
        }

        const newPath = path.join(targetDir, newFilename);
        if (newPath !== msg.filePath) {
          await fs.rename(msg.filePath, newPath);
          msg.filePath = newPath;
        }
      } catch (err: any) {
        this.logger.warn(`Could not rename physical Maildir file ${msg.filePath}: ${err.message}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Attachment Retrieval
  // ---------------------------------------------------------------------------

  async getAttachmentContent(
    msg: EmailMessage,
    attachmentId: string,
  ): Promise<{ filename: string; mimeType: string; content: Buffer } | null> {
    if (!msg.filePath) return null;

    try {
      let buffer: Buffer;
      if (msg.fileOffset !== undefined) {
        const rawMbox = await fs.readFile(msg.filePath, 'utf8');
        const chunks = this.splitMbox(rawMbox);
        if (msg.fileOffset >= chunks.length) return null;
        buffer = Buffer.from(chunks[msg.fileOffset], 'utf8');
      } else {
        buffer = await fs.readFile(msg.filePath);
      }

      const parsed = await simpleParser(buffer);
      for (let i = 0; i < (parsed.attachments || []).length; i++) {
        const att = parsed.attachments[i];
        if (
          att.cid === attachmentId ||
          att.filename === attachmentId ||
          `att_${i}` === attachmentId ||
          attachmentId.includes(`att_${i}`)
        ) {
          return {
            filename: att.filename || `attachment_${i}`,
            mimeType: att.contentType || 'application/octet-stream',
            content: att.content,
          };
        }
      }
    } catch (err: any) {
      this.logger.error(`Error loading attachment content: ${err.message}`);
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Attachment Upload Handling (Composer)
  // ---------------------------------------------------------------------------

  async saveUploadedFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
    path?: string;
  }): Promise<{ id: string; filename: string; mimeType: string; size: number; tempPath: string }> {
    const id = randomUUID();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = path.join(this.uploadDir, `${id}_${safeName}`);

    if (file.buffer) {
      await fs.writeFile(tempPath, file.buffer);
    } else if (file.path) {
      await fs.copyFile(file.path, tempPath);
    }

    return {
      id,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      tempPath,
    };
  }

  // ---------------------------------------------------------------------------
  // Draft Management
  // ---------------------------------------------------------------------------

  async saveDraft(
    mailboxEmail: string,
    draft: {
      id?: string;
      to?: EmailAddress[];
      cc?: EmailAddress[];
      bcc?: EmailAddress[];
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
    },
  ): Promise<{ draftId: string }> {
    const maildir = await this.getEffectiveMaildir(mailboxEmail);
    const draftsDir = path.join(maildir, '.Drafts', 'cur');
    await fs.mkdir(draftsDir, { recursive: true });

    const draftId = draft.id || `draft_${Date.now()}_${randomUUID()}`;
    const fileName = `${Date.now()}.${draftId}:2,DS`;
    const filePath = path.join(draftsDir, fileName);

    const domain = mailboxEmail.split('@')[1] || 'mail';
    const raw = [
      `From: ${mailboxEmail}`,
      `To: ${(draft.to || []).map((t) => (t.name ? `"${t.name}" <${t.email}>` : t.email)).join(', ')}`,
      `Subject: ${draft.subject || '(No Subject)'}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${draftId}@${domain}>`,
      'Content-Type: text/html; charset=utf-8',
      '',
      draft.bodyHtml || draft.bodyText || '',
    ].join('\r\n');

    await fs.writeFile(filePath, raw, 'utf8');
    return { draftId };
  }

  private async getMailboxProfile(email: string): Promise<{ name?: string; avatarUrl?: string } | null> {
    try {
      const raw = await fs.readFile(getDataFilePath('mail-domains.json'), 'utf8');
      const domains = JSON.parse(raw);
      const cleanEmail = email.toLowerCase().trim();
      for (const d of domains) {
        const mb = (d.mailboxes || []).find((m: any) => m.email.toLowerCase() === cleanEmail);
        if (mb) {
          return { name: mb.name, avatarUrl: mb.avatarUrl };
        }
      }
    } catch {}
    return null;
  }

  // ---------------------------------------------------------------------------
  // SMTP Outbound Delivery
  // ---------------------------------------------------------------------------

  async sendRealSmtp(
    fromEmail: string,
    payload: {
      to: EmailAddress[];
      cc?: EmailAddress[];
      bcc?: EmailAddress[];
      subject: string;
      bodyHtml?: string;
      bodyText?: string;
      attachments?: any[];
      replyToMessageId?: string;
      messageIdHeader?: string;
    },
  ): Promise<{ messageId: string; messageIdHeader: string; filePath?: string; fileName?: string }> {
    if (!this.smtpTransporter) {
      this.initSmtp();
    }

    const profile = await this.getMailboxProfile(fromEmail);
    const displayName = profile?.name?.trim();
    const formattedFrom = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
    const domain = fromEmail.split('@')[1] || 'mail';
    const serverHost = process.env.PANEL_HOST || 'panel.mainserver.in';
    const avatarUrl = `https://${serverHost}/api/mail/avatars/${encodeURIComponent(fromEmail)}`;
    const cleanInitialId = payload.messageIdHeader ? payload.messageIdHeader.replace(/^<+|>+$/g, '').trim() : `${randomUUID()}@${domain}`;
    const generatedMsgId = `<${cleanInitialId}>`;

    const mailAttachments: any[] = [];
    if (payload.attachments && payload.attachments.length > 0) {
      for (const att of payload.attachments) {
        if (att.tempPath) {
          mailAttachments.push({
            filename: att.filename,
            path: att.tempPath,
            contentType: att.mimeType,
          });
        }
      }
    }

    let finalHtml = payload.bodyHtml;
    if (!finalHtml && payload.bodyText) {
      const escaped = payload.bodyText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
      finalHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #202124; line-height: 1.6;">${escaped}</div>`;
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: formattedFrom,
      sender: fromEmail,
      replyTo: displayName ? `"${displayName}" <${fromEmail}>` : fromEmail,
      to: payload.to.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', '),
      cc: payload.cc?.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', '),
      bcc: payload.bcc?.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', '),
      subject: payload.subject,
      text: payload.bodyText,
      html: finalHtml,
      messageId: generatedMsgId,
      headers: {
        'X-Mailer': 'ClearPanel ClearMail',
        'X-Avatar-URL': avatarUrl,
        'X-Image-URL': avatarUrl,
        'Image-URL': avatarUrl,
        'X-Sender-Avatar': avatarUrl,
        'BIMI-Location': `v=BIMI1; l=https://${serverHost}/api/mail/bimi/${encodeURIComponent(domain)}.svg;`,
        'Auto-Submitted': 'no',
      },
      inReplyTo: payload.replyToMessageId,
      references: payload.replyToMessageId ? [payload.replyToMessageId] : undefined,
      attachments: mailAttachments,
    };

    let sentId: string = generatedMsgId.replace(/^<+|>+$/g, '');
    try {
      const info = await this.smtpTransporter!.sendMail(mailOptions);
      sentId = (info.messageId || sentId).replace(/^<+|>+$/g, '');
      this.logger.log(`Dispatched real SMTP email from ${formattedFrom} (ID: ${sentId})`);
    } catch (err: any) {
      this.logger.warn(`SMTP send warning (local relay): ${err.message}. Saving to Sent folder.`);
    }

    const sentResult = await this.saveSentMessage(fromEmail, formattedFrom, payload, sentId);

    // Clean up temporary composer upload files
    if (payload.attachments) {
      for (const att of payload.attachments) {
        if (att.tempPath) {
          try {
            await fs.unlink(att.tempPath);
          } catch {}
        }
      }
    }

    return {
      messageId: sentId,
      messageIdHeader: sentResult.messageIdHeader,
      filePath: sentResult.filePath,
      fileName: sentResult.fileName,
    };
  }

  private async saveSentMessage(
    fromEmail: string,
    formattedFrom: string,
    payload: any,
    messageId: string,
  ): Promise<{ filePath: string; fileName: string; messageIdHeader: string }> {
    const cleanId = messageId.replace(/^<+|>+$/g, '').trim();
    const messageIdHeader = `<${cleanId}>`;
    try {
      const maildir = await this.getEffectiveMaildir(fromEmail);
      const sentDir = path.join(maildir, '.Sent', 'cur');
      await fs.mkdir(sentDir, { recursive: true });

      const fileName = `${Date.now()}.${randomUUID()}:2,S`;
      const filePath = path.join(sentDir, fileName);

      const rawContent = [
        `From: ${formattedFrom}`,
        `To: ${payload.to.map((t: any) => (t.name ? `"${t.name}" <${t.email}>` : t.email)).join(', ')}`,
        `Subject: ${payload.subject}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: ${messageIdHeader}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'X-Mailer: ClearPanel ClearMail',
        '',
        payload.bodyHtml || payload.bodyText || '',
      ].join('\r\n');

      await fs.writeFile(filePath, rawContent, 'utf8');

      // Also append to mbox Sent if present
      const mboxSent = path.join(maildir, 'mail', 'Sent');
      try {
        await fs.access(path.dirname(mboxSent));
        const mboxHeader = `From ${fromEmail}  ${new Date().toUTCString()}\n`;
        await fs.appendFile(mboxSent, `\n${mboxHeader}${rawContent}\n`, 'utf8');
      } catch {}

      return { filePath, fileName, messageIdHeader };
    } catch (err: any) {
      this.logger.error(`Failed to write sent message: ${err.message}`);
      return { filePath: '', fileName: '', messageIdHeader };
    }
  }

  private sanitizeId(id: string): string {
    return id.replace(/[<>:"/\\|?*]/g, '_');
  }

  private hashString(str: string): string {
    return createHash('sha256').update(str).digest('hex').substring(0, 16);
  }
}
