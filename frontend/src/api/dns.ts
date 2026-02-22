// DNS API client

const API_BASE = '/api/dns';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const dnsApi = {
  listZones: () => fetchJSON(`${API_BASE}/zones`),
  getZone: (domain: string) => fetchJSON(`${API_BASE}/zones/${encodeURIComponent(domain)}`),
  addRecord: (domain: string, record: { type: string; name: string; value: string; ttl?: number; priority?: number }) =>
    fetchJSON(`${API_BASE}/zones/${encodeURIComponent(domain)}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }),
  updateRecord: (domain: string, id: string, updates: Record<string, any>) =>
    fetchJSON(`${API_BASE}/zones/${encodeURIComponent(domain)}/records/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),
  deleteRecord: (domain: string, id: string) =>
    fetchJSON(`${API_BASE}/zones/${encodeURIComponent(domain)}/records/${id}`, { method: 'DELETE' }),
};
