// BaaS API Client (Firebase / Supabase Alternative)

const API_BASE = '/api/baas';

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

export type BaasStatus = 'running' | 'stopped' | 'error' | 'installing';

export interface BaasInstance {
  id: string;
  name: string;
  port: number;
  domain?: string;
  status: BaasStatus;
  dataPath: string;
  adminUrl: string;
  apiUrl: string;
  adminEmail?: string;
  createdAt: string;
  version?: string;
  pid?: number;
  memoryUsageMb?: number;
}

export interface CreateBaasDto {
  name: string;
  port?: number;
  domain?: string;
  adminEmail: string;
  adminPassword?: string;
}

export interface BaasSdkSnippet {
  language: 'javascript' | 'flutter' | 'python' | 'curl';
  label: string;
  code: string;
}

export interface BaasOverviewStats {
  installed: boolean;
  pocketbaseVersion?: string;
  totalInstances: number;
  runningInstances: number;
}

// ── API Methods ────────────────────────────────────────────────────────────

export const baasApi = {
  getStats: () => fetchJSON<BaasOverviewStats>(`${API_BASE}/stats`),

  installBinary: () =>
    post<{ installed: boolean; path?: string; version?: string; error?: string }>(`${API_BASE}/install`),

  listInstances: () =>
    fetchJSON<{ success: boolean; instances: BaasInstance[] }>(`${API_BASE}/instances`),

  createInstance: (dto: CreateBaasDto) =>
    post<{ success: boolean; instance: BaasInstance }>(`${API_BASE}/instances`, dto),

  getInstance: (id: string) =>
    fetchJSON<{ success: boolean; instance: BaasInstance }>(`${API_BASE}/instances/${id}`),

  startInstance: (id: string) =>
    post<{ success: boolean; message: string }>(`${API_BASE}/instances/${id}/start`),

  stopInstance: (id: string) =>
    post<{ success: boolean; message: string }>(`${API_BASE}/instances/${id}/stop`),

  restartInstance: (id: string) =>
    post<{ success: boolean; message: string }>(`${API_BASE}/instances/${id}/restart`),

  deleteInstance: (id: string) =>
    del<{ success: boolean; message: string }>(`${API_BASE}/instances/${id}`),

  getLogs: (id: string, lines = 50) =>
    fetchJSON<{ success: boolean; logs: string }>(`${API_BASE}/instances/${id}/logs?lines=${lines}`),

  getSnippets: (id: string) =>
    fetchJSON<{ success: boolean; snippets: BaasSdkSnippet[] }>(`${API_BASE}/instances/${id}/snippets`),
};
