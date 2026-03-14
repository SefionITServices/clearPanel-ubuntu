const BASE = '/api/spam-filter';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const spamFilterApi = {
  getStatus: () => fetchJSON(`${BASE}/status`),
  getHistory: (limit = 50) => fetchJSON(`${BASE}/history?limit=${limit}`),
  getSettings: (domain: string) => fetchJSON(`${BASE}/settings?domain=${encodeURIComponent(domain)}`),
  saveSettings: (payload: { domain: string; addHeaderScore?: number; rejectScore?: number; whitelist?: string[]; blacklist?: string[] }) =>
    fetchJSON(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
