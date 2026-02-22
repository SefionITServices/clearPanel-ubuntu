// Domains API client

const API_BASE = '/api/domains';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const domainsApi = {
  list: () => fetchJSON(`${API_BASE}`),
  create: (name: string) => fetchJSON(`${API_BASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }),
  delete: (id: string) => fetchJSON(`${API_BASE}/${id}`, { method: 'DELETE' }),
  getVhost: (id: string) => fetchJSON(`${API_BASE}/${id}/vhost`),
  saveVhost: (id: string, config: string) => fetchJSON(`${API_BASE}/${id}/vhost`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  }),
  updateSettings: (id: string, settings: Record<string, any>) => fetchJSON(`${API_BASE}/${id}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  }),
  updatePath: (id: string, folderPath: string) => fetchJSON(`${API_BASE}/${id}/path`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath }),
  }),
};
