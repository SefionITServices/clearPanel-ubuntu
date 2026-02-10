export interface Mailbox {
  id: string;
  email: string;
  passwordHash: string;
  quotaMb?: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MailAlias {
  id: string;
  source: string;
  destination: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MailDomain {
  id: string;
  domain: string;
  enabled: boolean;
  spamThreshold?: number;
  greylistingEnabled?: boolean;
  greylistingDelaySeconds?: number;
  virusScanEnabled?: boolean;
  dkimSelector?: string;
  dkimPublicKey?: string;
  dkimUpdatedAt?: string;
  catchAllAddress?: string;
  createdAt: string;
  updatedAt?: string;
  mailboxes: Mailbox[];
  aliases: MailAlias[];
}

// ---- Sieve Filters ----

export interface SieveFilter {
  name: string;
  script: string;
  active: boolean;
}

// ---- SMTP Relay ----

export interface SmtpRelayConfig {
  configured: boolean;
  host?: string;
  port?: number;
  authenticated?: boolean;
  username?: string;
  updatedAt?: string;
}

// ---- Quota Warning ----

export interface QuotaWarningConfig {
  threshold: number;
  adminEmail?: string;
  updatedAt?: string;
}

// ---- DMARC Reports ----

export interface DmarcReportRecord {
  sourceIp: string;
  count: number;
  disposition: string;
  dkimEval: string;
  spfEval: string;
  dkimResult: string;
  spfResult: string;
}

export interface DmarcReport {
  org: string;
  reportId: string;
  dateBegin: string;
  dateEnd: string;
  domain: string;
  policy: string;
  subdomainPolicy: string;
  pct: number;
  records: DmarcReportRecord[];
  totalMessages: number;
  passCount: number;
  failCount: number;
}

export interface DmarcReportSummary {
  reportCount: number;
  totalMessages: number;
  passCount: number;
  failCount: number;
  passRate: number;
  organizations: string[];
  topSenders: { ip: string; count: number }[];
}
