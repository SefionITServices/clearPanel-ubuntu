const BASE = '/api/mailing-lists';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const mailingListsApi = {
  list: (domain: string) => fetchJSON(`${BASE}?domain=${encodeURIComponent(domain)}`),
  create: (payload: { domain: string; name: string; subscribers: string[] }) =>
    fetchJSON(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => fetchJSON(`${BASE}/${id}`, { method: 'DELETE' }),
  addSubscriber: (listId: string, email: string) =>
    fetchJSON(`${BASE}/${listId}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  removeSubscriber: (listId: string, email: string) =>
    fetchJSON(`${BASE}/${listId}/subscribers/${encodeURIComponent(email)}`, { method: 'DELETE' }),
};
