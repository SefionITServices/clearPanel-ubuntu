const BASE = '/api/error-pages';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const errorPagesApi = {
  list: (domain: string) => fetchJSON(`${BASE}?domain=${encodeURIComponent(domain)}`),
  save: (payload: { domain: string; code: string; html: string; enabled: boolean }) =>
    fetchJSON(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => fetchJSON(`${BASE}/${id}`, { method: 'DELETE' }),
};
