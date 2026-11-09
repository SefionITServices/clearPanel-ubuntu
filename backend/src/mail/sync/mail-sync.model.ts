export interface EmailAddress {
  name: string;
  email: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  url?: string;
}

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'starred' | 'archive';

export interface EmailSecurityStatus {
  spf: 'pass' | 'fail' | 'neutral' | 'none';
  dkim: 'pass' | 'fail' | 'none';
  dmarc: 'pass' | 'fail' | 'none';
  tlsVersion?: string;
  signedBy?: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  mailboxEmail: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references?: string[];
  folder: MailFolder;
  labels: string[];
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  security?: EmailSecurityStatus;
  headers?: Record<string, string>;
  date: string;
  size: number;
}

export interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  lastMessageDate: string;
  messageCount: number;
  unreadCount: number;
  participants: EmailAddress[];
  folder: MailFolder;
  labels: string[];
  hasAttachments: boolean;
  isStarred: boolean;
  messages?: EmailMessage[];
}

export interface PendingSendItem {
  id: string;
  mailboxEmail: string;
  message: EmailMessage;
  queuedAt: number;
  sendAfter: number;
  status: 'pending' | 'cancelled' | 'sending' | 'sent' | 'failed';
  error?: string;
}

export interface MailboxStats {
  mailboxEmail: string;
  unreadCount: number;
  totalThreads: number;
  usedBytes: number;
  quotaBytes: number;
  foldersCount: Record<MailFolder, number>;
}

