const BASE = '/api/hotlink';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const hotlinkApi = {
  get: (domain: string) => fetchJSON(`${BASE}/${encodeURIComponent(domain)}`),
  set: (payload: { domain: string; enabled: boolean; allowedDomains?: string[]; blockExtensions?: string[] }) =>
    fetchJSON(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  disable: (domain: string) =>
    fetchJSON(`${BASE}/${encodeURIComponent(domain)}`, { method: 'DELETE' }),
};
