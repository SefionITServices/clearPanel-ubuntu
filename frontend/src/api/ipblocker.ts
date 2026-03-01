const BASE = '/api/ip-blocker';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const ipBlockerApi = {
  list: (domain?: string) =>
    fetchJSON(`${BASE}${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),
  create: (payload: { domain: string; ip: string; note?: string }) =>
    fetchJSON(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => fetchJSON(`${BASE}/${id}`, { method: 'DELETE' }),
};
