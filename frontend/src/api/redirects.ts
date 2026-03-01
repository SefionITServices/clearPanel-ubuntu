const BASE = '/api/redirects';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const redirectsApi = {
  list: (domain?: string) =>
    fetchJSON(`${BASE}${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),
  create: (payload: { domain: string; from: string; to: string; type: '301' | '302'; wildcard?: boolean }) =>
    fetchJSON(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => fetchJSON(`${BASE}/${id}`, { method: 'DELETE' }),
};
