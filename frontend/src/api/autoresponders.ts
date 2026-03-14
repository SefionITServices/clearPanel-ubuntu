const BASE = '/api/mail/domains';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const autorespondersApi = {
  list: (domainId: string) => fetchJSON(`${BASE}/${domainId}/autoresponders`),
  save: (domainId: string, payload: { email: string; subject: string; body: string; startDate?: string; endDate?: string; enabled: boolean }) =>
    fetchJSON(`${BASE}/${domainId}/autoresponders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  remove: (domainId: string, email: string) => fetchJSON(`${BASE}/${domainId}/autoresponders/${encodeURIComponent(email)}`, { method: 'DELETE' }),
};
