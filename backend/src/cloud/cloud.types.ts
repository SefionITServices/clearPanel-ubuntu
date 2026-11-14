// ClearPanel Cloud Suite Data Contracts

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

// ── S3 Object Storage (ClearStorage) ─────────────────────────────────────────

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

export interface CreateBucketDto {
  name: string;
  visibility?: 'private' | 'public-read';
}

// ── Transactional Email API (ClearSES) ────────────────────────────────────────

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

// ── Secrets & Environment Vault (ClearVault) ──────────────────────────────────

export interface VaultSecret {
  id: string;
  project: string;
  environment: 'production' | 'staging' | 'development';
  key: string;
  value: string; // Stored encrypted at rest
  updatedAt: string;
}

export interface SaveSecretDto {
  project: string;
  environment: 'production' | 'staging' | 'development';
  key: string;
  value: string;
}

// ── Redis Cache (ClearCache) ──────────────────────────────────────────────────

export interface RedisCacheInfo {
  installed: boolean;
  running: boolean;
  version?: string;
  port: number;
  usedMemory: string;
  connectedClients: number;
  connectionString: string;
}
