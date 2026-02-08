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
  async listDomains(): Promise<MailDomain[]> {
    return fetchJSON<MailDomain[]>(`${API_BASE}/domains`);
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
};
