// Node.js / Python App Manager API client

const BASE = '/api/node-apps';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

const post = (url: string, body?: any) =>
  fetchJSON(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const put = (url: string, body: any) =>
  fetchJSON(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const del = (url: string) => fetchJSON(url, { method: 'DELETE' });

export interface AppDef {
  id: string;
  name: string;
  runtime: 'node' | 'python' | 'static';
  directory: string;
  startCommand: string;
  port?: number;
  env: { key: string; value: string }[];
  description?: string;
  domain?: string;
  createdAt: string;
  status?: string;
  pid?: number;
  restarts?: number;
  cpu?: string;
  memory?: string;
  uptime?: string;
}

export const nodeAppsApi = {
  runtimes: () => fetchJSON(`${BASE}/runtimes`),
  pm2Status: () => fetchJSON(`${BASE}/pm2/status`),
  installPm2: () => post(`${BASE}/pm2/install`),

  list: () => fetchJSON<{ success: boolean; apps: AppDef[] }>(`${BASE}`),
  create: (payload: Omit<AppDef, 'id' | 'createdAt' | 'status'>) => post(BASE, payload),
  clone: (payload: { name: string; runtime: string; repoUrl: string; branch?: string; directory: string; startCommand: string; port?: number }) =>
    post(`${BASE}/clone`, payload),
  update: (id: string, payload: Partial<AppDef>) => put(`${BASE}/${id}`, payload),
  remove: (id: string) => del(`${BASE}/${id}`),

  start: (id: string) => post(`${BASE}/${id}/start`),
  stop: (id: string) => post(`${BASE}/${id}/stop`),
  restart: (id: string) => post(`${BASE}/${id}/restart`),
  logs: (id: string, lines = 200) => fetchJSON(`${BASE}/${id}/logs?lines=${lines}`),
  pull: (id: string) => post(`${BASE}/${id}/pull`),
  setEnv: (id: string, env: { key: string; value: string }[]) => post(`${BASE}/${id}/env`, { env }),
};
