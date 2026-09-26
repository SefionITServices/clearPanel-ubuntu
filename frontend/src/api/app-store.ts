// App Store API client

const API_BASE = '/api/app-store';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const appStoreApi = {
  listApps: () => fetchJSON(`${API_BASE}/apps`),
  installApp: (id: string, options?: Record<string, string>) =>
    fetchJSON(`${API_BASE}/install/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: options ? JSON.stringify(options) : undefined,
    }),
  uninstallApp: (id: string) => fetchJSON(`${API_BASE}/uninstall/${id}`, { method: 'DELETE' }),
  diagnoseApp: (id: string) => fetchJSON(`${API_BASE}/diagnose/${id}`),
  reconfigure: (id: string) => fetchJSON(`${API_BASE}/reconfigure/${id}`, { method: 'POST' }),
  repairApp: (id: string) => fetchJSON(`${API_BASE}/repair/${id}`, { method: 'POST' }),
  prepareApp: (id: string) => fetchJSON(`${API_BASE}/prepare/${id}`, { method: 'POST' }),
  getRedisInfo: () => fetchJSON<{ success: boolean; info: {
    installed: boolean;
    running: boolean;
    configPath: string;
    host: string;
    externalHost: string;
    port: number;
    bind: string[];
    protectedMode: boolean | null;
    requirePassEnabled: boolean;
    password: string;
    redisUrl: string;
    cliPingCommand: string;
    notes: string[];
  } }>(`${API_BASE}/redis/info`),
};
