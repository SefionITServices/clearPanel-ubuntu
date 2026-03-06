// Mail API client for managing mail domains and policy settings

export interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

export interface MailboxSummary {
  id: string;
  email: string;
  quotaMb?: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MailAliasSummary {
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
  mailboxes: MailboxSummary[];
  aliases: MailAliasSummary[];
}

export interface DomainSettingsUpdate {
  spamThreshold?: number | null;
  greylistingEnabled?: boolean | null;
  greylistingDelaySeconds?: number | null;
  virusScanEnabled?: boolean | null;
}

export interface MailDomainResult {
  domain: MailDomain;
  automationLogs: AutomationLog[];
}

export interface MailAutomationHistoryRecord {
  id: string;
  domainId?: string;
  domain?: string;
  scope: 'stack' | 'domain' | 'mailbox' | 'alias' | 'dkim';
  target?: string;
  task: string;
  success: boolean;
  message?: string;
  detail?: string;
  executedAt: string;
}

interface DomainLogResponse {
  domain: string;
  records: MailAutomationHistoryRecord[];
}

export interface CreateMailboxPayload {
  email: string;
  password?: string;
  passwordHash?: string;
  quotaMb?: number;
}

export interface UpdateMailboxPayload {
  password?: string;
  passwordHash?: string;
  quotaMb?: number | null;
}

export interface CreateAliasPayload {
  source: string;
  destination: string;
}

export interface UpdateAliasPayload {
  destination: string;
}

export interface CreateDomainPayload {
  domain: string;
  spamThreshold?: number;
  greylistingEnabled?: boolean;
  greylistingDelaySeconds?: number;
  virusScanEnabled?: boolean;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
}

export interface DnsSuggestionsResponse {
  domain: string;
  records: DnsRecord[];
}

export interface MailServiceStatus {
  name: string;
  active: boolean;
}

export interface MailStatusResponse {
  services: MailServiceStatus[];
  queueDepth?: number;
}

export interface SecurityStatus {
  tls: { configured: boolean; hostname?: string; certDir?: string; configuredAt?: string };
  postscreen: { enabled: boolean; configuredAt?: string };
  dmarc: { domains: string[]; configuredAt?: string };
}

export interface AutomationResult {
  automationLogs: AutomationLog[];
}

export interface DnsPublishRecord {
  type: string;
  name: string;
  value: string;
  status: 'created' | 'exists' | 'error';
  error?: string;
}

export interface DnsPublishResult {
  published: DnsPublishRecord[];
  zoneReload?: { success: boolean; message: string };
}

export interface RspamdStats {
  scanned?: number;
  learned?: number;
  spamCount?: number;
  hamCount?: number;
  greylistedCount?: number;
  rejectCount?: number;
}

export interface MailboxDiskUsageEntry {
  email: string;
  bytes: number;
}

export interface DomainDiskUsage {
  domain: string;
  totalBytes: number;
  mailboxes: MailboxDiskUsageEntry[];
}

export interface DeliveryStats {
  sent: number;
  received: number;
  bounced: number;
  deferred: number;
  rejected: number;
}

export interface MailMetricsResponse {
  rspamd?: RspamdStats;
  diskUsage?: DomainDiskUsage[];
  delivery?: DeliveryStats;
  dovecotConnections?: number;
}

// ---- Queue Management ----

export interface MailQueueStatus {
  total?: number;
  sample?: string[];
  message?: string;
  error?: string;
}

// ---- Mail Logs ----

export interface MailLogsResponse {
  lines: string[];
  total: number;
}

// ---- DNS Propagation Check ----

export interface DnsPropagationRecord {
  record: { type: string; name: string; expected: string };
  actual: string[];
  match: boolean;
}

export interface DnsPropagationResult {
  domain: string;
  results: DnsPropagationRecord[];
  allPropagated: boolean;
}

// ---- Mailbox Backup / Restore ----

export interface BackupEntry {
  file: string;
  domain: string;
  email: string;
  timestamp: string;
  sizeBytes: number;
}

export interface BackupResult {
  path: string;
  sizeBytes: number;
  automationLogs: AutomationLog[];
}

// ---- Rate Limiting ----

export interface RateLimitEntry {
  email: string;
  limit: number;
  updatedAt?: string;
}

// ---- Sieve Filters ----

export interface SieveFilterEntry {
  name: string;
  active: boolean;
}

export interface SieveFilterDetail {
  name: string;
  script: string;
}

// ---- Catch-All ----

export interface CatchAllResult {
  domain: MailDomain;
  automationLogs: AutomationLog[];
}

// ---- Quota Warning ----

export interface QuotaWarningConfig {
  threshold: number;
  adminEmail?: string;
  updatedAt?: string;
}

// ---- SMTP Relay ----

export interface SmtpRelayConfig {
  configured: boolean;
  host?: string;
  port?: number;
  authenticated?: boolean;
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

const API_BASE = '/api/mail';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'include',
  });

  const parseBody = async () => {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch (error) {
      return undefined;
    }
  };

  if (!response.ok) {
    const body = (await parseBody()) as { message?: string; error?: string } | undefined;
    const message = body?.message || body?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const body = await parseBody();
  return body as T;
}

export const mailAPI = {
  async getStatus(): Promise<MailStatusResponse> {
    return fetchJSON<MailStatusResponse>(`${API_BASE}/status`);
  },

  async listDomains(): Promise<MailDomain[]> {
    return fetchJSON<MailDomain[]>(`${API_BASE}/domains`);
  },

  async createDomain(payload: CreateDomainPayload): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteDomain(domainId: string): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}`, {
      method: 'DELETE',
    });
  },

  async updateDomainSettings(domainId: string, updates: DomainSettingsUpdate): Promise<MailDomainResult> {
    const payload: DomainSettingsUpdate = { ...updates };
    const result = await fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return result;
  },

  async getDomainLogs(domainId: string, limit: number = 10): Promise<MailAutomationHistoryRecord[]> {
    const search = new URLSearchParams();
    if (limit) {
      search.set('limit', String(limit));
    }
    const query = search.toString();
    const url = query ? `${API_BASE}/domains/${domainId}/logs?${query}` : `${API_BASE}/domains/${domainId}/logs`;
    const response = await fetchJSON<DomainLogResponse>(url);
    return response.records;
  },

  async addMailbox(domainId: string, payload: CreateMailboxPayload): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/mailboxes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMailbox(domainId: string, mailboxId: string, payload: UpdateMailboxPayload): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async removeMailbox(domainId: string, mailboxId: string): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}`, {
      method: 'DELETE',
    });
  },

  async addAlias(domainId: string, payload: CreateAliasPayload): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/aliases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAlias(domainId: string, aliasId: string, payload: UpdateAliasPayload): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/aliases/${aliasId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async removeAlias(domainId: string, aliasId: string): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/aliases/${aliasId}`, {
      method: 'DELETE',
    });
  },

  async getDnsSuggestions(domainId: string): Promise<DnsSuggestionsResponse> {
    return fetchJSON<DnsSuggestionsResponse>(`${API_BASE}/domains/${domainId}/dns`);
  },

  async rotateDkim(domainId: string, selector?: string): Promise<MailDomainResult> {
    return fetchJSON<MailDomainResult>(`${API_BASE}/domains/${domainId}/dkim/rotate`, {
      method: 'POST',
      body: JSON.stringify(selector ? { selector } : {}),
    });
  },

  // ---- TLS & Security Hardening (Phase 4) ----

  async getSecurityStatus(): Promise<SecurityStatus> {
    return fetchJSON<SecurityStatus>(`${API_BASE}/security/status`);
  },

  async setupMailTls(payload: { hostname: string; email: string; reuseExisting?: boolean }): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/security/tls`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async setupPostscreen(dryRun?: boolean): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/security/postscreen`, {
      method: 'POST',
      body: JSON.stringify({ dryRun }),
    });
  },

  async setupDmarc(payload: { domain: string; reportEmail?: string }): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/security/dmarc`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ---- Phase 5: DNS Auto-Publish & Metrics ----

  async publishDns(domainId: string): Promise<DnsPublishResult> {
    return fetchJSON<DnsPublishResult>(`${API_BASE}/domains/${domainId}/dns/publish`, {
      method: 'POST',
    });
  },

  async getMailMetrics(): Promise<MailMetricsResponse> {
    return fetchJSON<MailMetricsResponse>(`${API_BASE}/metrics`);
  },

  // ---- Queue Management ----

  async getQueue(): Promise<MailQueueStatus> {
    return fetchJSON<MailQueueStatus>(`${API_BASE}/queue`);
  },

  async flushQueue(): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/queue/flush`, { method: 'POST' });
  },

  async deleteQueueMessage(queueId: string): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/queue/${queueId}`, { method: 'DELETE' });
  },

  async deleteAllQueueMessages(): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/queue`, { method: 'DELETE' });
  },

  async retryQueueMessage(queueId: string): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/queue/${queueId}/retry`, { method: 'POST' });
  },

  // ---- Mail Logs ----

  async getMailLogs(lines?: number, search?: string): Promise<MailLogsResponse> {
    const params = new URLSearchParams();
    if (lines) params.set('lines', String(lines));
    if (search) params.set('search', search);
    const query = params.toString();
    return fetchJSON<MailLogsResponse>(`${API_BASE}/logs${query ? `?${query}` : ''}`);
  },

  // ---- DNS Propagation Check ----

  async checkDnsPropagation(domainId: string): Promise<DnsPropagationResult> {
    return fetchJSON<DnsPropagationResult>(`${API_BASE}/domains/${domainId}/dns/check`);
  },

  // ---- Mailbox Backup / Restore ----

  async listBackups(domain?: string): Promise<BackupEntry[]> {
    const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return fetchJSON<BackupEntry[]>(`${API_BASE}/backups${params}`);
  },

  async backupMailbox(domainId: string, mailboxId: string): Promise<BackupResult> {
    return fetchJSON<BackupResult>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}/backup`, {
      method: 'POST',
    });
  },

  async restoreMailbox(domainId: string, mailboxId: string, backupFile: string): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ backupFile }),
    });
  },

  // ---- Rate Limiting ----

  async getRateLimits(domainId: string): Promise<RateLimitEntry[]> {
    return fetchJSON<RateLimitEntry[]>(`${API_BASE}/domains/${domainId}/rate-limits`);
  },

  async setupRateLimit(domainId: string, email: string, limitPerHour: number): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/domains/${domainId}/rate-limits`, {
      method: 'POST',
      body: JSON.stringify({ email, limitPerHour }),
    });
  },

  // ---- Sieve Filters (ManageSieve) ----

  async listSieveFilters(domainId: string, mailboxId: string): Promise<SieveFilterEntry[]> {
    return fetchJSON<SieveFilterEntry[]>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}/sieve`);
  },

  async getSieveFilter(domainId: string, mailboxId: string, filterName: string): Promise<SieveFilterDetail> {
    return fetchJSON<SieveFilterDetail>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}/sieve/${encodeURIComponent(filterName)}`);
  },

  async putSieveFilter(domainId: string, mailboxId: string, filterName: string, script: string): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}/sieve/${encodeURIComponent(filterName)}`, {
      method: 'POST',
      body: JSON.stringify({ script }),
    });
  },

  async deleteSieveFilter(domainId: string, mailboxId: string, filterName: string): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}/sieve/${encodeURIComponent(filterName)}`, {
      method: 'DELETE',
    });
  },

  // ---- Catch-All Mailbox ----

  async setupCatchAll(domainId: string, action: 'enable' | 'disable', targetEmail?: string): Promise<CatchAllResult> {
    return fetchJSON<CatchAllResult>(`${API_BASE}/domains/${domainId}/catch-all`, {
      method: 'POST',
      body: JSON.stringify({ action, targetEmail }),
    });
  },

  // ---- Quota Warnings ----

  async getQuotaWarningConfig(): Promise<QuotaWarningConfig | null> {
    return fetchJSON<QuotaWarningConfig | null>(`${API_BASE}/quota-warning`);
  },

  async setupQuotaWarning(threshold: number, adminEmail?: string): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/quota-warning`, {
      method: 'POST',
      body: JSON.stringify({ threshold, adminEmail }),
    });
  },

  // ---- SMTP Relay ----

  async getSmtpRelay(): Promise<SmtpRelayConfig> {
    return fetchJSON<SmtpRelayConfig>(`${API_BASE}/smtp-relay`);
  },

  async setupSmtpRelay(host: string, port: number, username?: string, password?: string): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/smtp-relay`, {
      method: 'POST',
      body: JSON.stringify({ host, port, username, password }),
    });
  },

  async removeSmtpRelay(): Promise<AutomationResult> {
    return fetchJSON<AutomationResult>(`${API_BASE}/smtp-relay`, {
      method: 'DELETE',
    });
  },

  // ---- DMARC Reports ----

  async getDmarcReports(domainId: string): Promise<DmarcReport[]> {
    return fetchJSON<DmarcReport[]>(`${API_BASE}/domains/${domainId}/dmarc-reports`);
  },

  async getDmarcSummary(domainId: string): Promise<DmarcReportSummary> {
    return fetchJSON<DmarcReportSummary>(`${API_BASE}/domains/${domainId}/dmarc-reports/summary`);
  },

  // ---- Webmail SSO ----

  async getSsoUrl(domainId: string, mailboxId: string): Promise<{ url: string; token: string }> {
    return fetchJSON<{ url: string; token: string }>(`${API_BASE}/domains/${domainId}/mailboxes/${mailboxId}/sso`, {
      method: 'POST',
    });
  },

  // ---- Webmail URL ----

  async getWebmailUrl(): Promise<{ webmailUrl: string | null }> {
    return fetchJSON<{ webmailUrl: string | null }>(`${API_BASE}/webmail-url`);
  },

  async setWebmailUrl(webmailUrl: string | null): Promise<{ webmailUrl: string | null }> {
    return fetchJSON<{ webmailUrl: string | null }>(`${API_BASE}/webmail-url`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webmailUrl }),
    });
  },
};
