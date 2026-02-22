// License API client

const API_BASE = '/api/license';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const licenseApi = {
  /** Get current license status */
  getStatus: () => fetchJSON(`${API_BASE}`),

  /** Activate a license key */
  activate: (key: string) =>
    fetchJSON(`${API_BASE}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    }),

  /** Deactivate current license */
  deactivate: () =>
    fetchJSON(`${API_BASE}`, { method: 'DELETE' }),

  /** Check for updates */
  checkUpdate: () => fetchJSON(`${API_BASE}/update`),
};
