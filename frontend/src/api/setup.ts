// Setup API client

const API_BASE = '/api/setup';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const setupApi = {
  getStatus: () => fetchJSON(`${API_BASE}/status`),
  detectIp: () => fetchJSON(`${API_BASE}/detect-ip`),
  complete: (config: Record<string, any>) => fetchJSON(`${API_BASE}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }),
};
