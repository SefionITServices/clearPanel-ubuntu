// ClearPanel Cloud Suite API Client

const API_BASE = '/api/cloud';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

function post<T = any>(url: string, body?: unknown): Promise<T> {
  return fetchJSON(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function del<T = any>(url: string): Promise<T> {
  return fetchJSON(url, { method: 'DELETE' });
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CloudOverviewStats {
  baasInstancesCount: number;
  baasRunningCount: number;
  s3BucketsCount: number;
  s3TotalSizeBytes: number;
  sesApiKeysCount: number;
  sesEmailsSentCount: number;
  vaultSecretsCount: number;
  vaultProjectsCount: number;
  redisRunning: boolean;
  redisMemoryUsage: string;
  estimatedMonthlySavingsUsd: number;
}

export interface S3Bucket {
  name: string;
  visibility: 'private' | 'public-read';
  createdAt: string;
  sizeBytes: number;
  objectsCount: number;
  endpointUrl: string;
}

export interface S3AccessKey {
  id: string;
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface SesApiKey {
  id: string;
  name: string;
  key: string;
  domain?: string;
  createdAt: string;
  lastUsedAt?: string;
  status: 'active' | 'revoked';
}

export interface SendEmailDto {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  apiKey?: string;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  from: string;
  subject: string;
  status: 'sent' | 'failed' | 'queued';
  sentAt: string;
  error?: string;
}

export interface VaultSecret {
  id: string;
  project: string;
  environment: 'production' | 'staging' | 'development';
  key: string;
  value: string;
  updatedAt: string;
}

export interface SaveSecretDto {
  project: string;
  environment: 'production' | 'staging' | 'development';
  key: string;
  value: string;
}

export interface RedisCacheInfo {
  installed: boolean;
  running: boolean;
  version?: string;
  port: number;
  usedMemory: string;
  connectedClients: number;
  connectionString: string;
}

// ── API Methods ────────────────────────────────────────────────────────────

export const cloudApi = {
  getStats: () => fetchJSON<CloudOverviewStats>(`${API_BASE}/stats`),

  // S3
  listBuckets: () => fetchJSON<{ success: boolean; buckets: S3Bucket[] }>(`${API_BASE}/s3/buckets`),
  createBucket: (dto: { name: string; visibility?: 'private' | 'public-read' }) =>
    post<{ success: boolean; bucket: S3Bucket }>(`${API_BASE}/s3/buckets`, dto),
  deleteBucket: (name: string) => del<{ success: boolean; message: string }>(`${API_BASE}/s3/buckets/${encodeURIComponent(name)}`),
  listS3Keys: () => fetchJSON<{ success: boolean; keys: S3AccessKey[] }>(`${API_BASE}/s3/keys`),
  createS3Key: (name: string) => post<{ success: boolean; key: S3AccessKey }>(`${API_BASE}/s3/keys`, { name }),
  deleteS3Key: (id: string) => del<{ success: boolean; message: string }>(`${API_BASE}/s3/keys/${id}`),

  // SES
  listSesKeys: () => fetchJSON<{ success: boolean; keys: SesApiKey[] }>(`${API_BASE}/ses/keys`),
  createSesKey: (name: string, domain?: string) =>
    post<{ success: boolean; key: SesApiKey }>(`${API_BASE}/ses/keys`, { name, domain }),
  revokeSesKey: (id: string) => post<{ success: boolean; message: string }>(`${API_BASE}/ses/keys/${id}/revoke`),
  sendEmail: (dto: SendEmailDto) => post<{ success: boolean; messageId: string }>(`${API_BASE}/ses/send`, dto),
  getEmailLogs: () => fetchJSON<{ success: boolean; logs: EmailLogEntry[] }>(`${API_BASE}/ses/logs`),

  // Vault
  listSecrets: (project?: string, env?: string) => {
    const q = new URLSearchParams();
    if (project) q.append('project', project);
    if (env) q.append('env', env);
    return fetchJSON<{ success: boolean; secrets: VaultSecret[] }>(`${API_BASE}/vault/secrets?${q.toString()}`);
  },
  saveSecret: (dto: SaveSecretDto) => post<{ success: boolean; secret: VaultSecret }>(`${API_BASE}/vault/secrets`, dto),
  deleteSecret: (id: string) => del<{ success: boolean; message: string }>(`${API_BASE}/vault/secrets/${id}`),
  exportEnv: (project: string, env: 'production' | 'staging' | 'development') =>
    fetchJSON<{ success: boolean; envContent: string }>(`${API_BASE}/vault/export?project=${encodeURIComponent(project)}&env=${env}`),

  // Redis
  getRedisInfo: () => fetchJSON<RedisCacheInfo>(`${API_BASE}/cache/redis`),
};
