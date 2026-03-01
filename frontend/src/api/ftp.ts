// FTP API client

const API_BASE = '/api/ftp';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const ftpApi = {
  status: () => fetchJSON(`${API_BASE}/status`),
  list: () => fetchJSON(`${API_BASE}/accounts`),
  create: (payload: { domain: string; username: string; password: string; rootPath?: string }) =>
    fetchJSON(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  resetPassword: (login: string, password: string) =>
    fetchJSON(`${API_BASE}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    }),
  remove: (id: string) => fetchJSON(`${API_BASE}/accounts/${id}`, { method: 'DELETE' }),
};
