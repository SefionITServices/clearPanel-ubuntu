const BASE = '/api/dir-privacy';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const dirPrivacyApi = {
  list: (domain?: string) =>
    fetchJSON(`${BASE}${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),
  create: (payload: { domain: string; dirPath: string; label: string }) =>
    fetchJSON(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => fetchJSON(`${BASE}/${id}`, { method: 'DELETE' }),
  addUser: (id: string, username: string, password: string) =>
    fetchJSON(`${BASE}/${id}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  removeUser: (id: string, username: string) =>
    fetchJSON(`${BASE}/${id}/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),
};
