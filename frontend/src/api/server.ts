// Server API client

const API_BASE = '/api/server';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const serverApi = {
  getHostname: () => fetchJSON(`${API_BASE}/hostname`),
  setHostname: (hostname: string) => fetchJSON(`${API_BASE}/hostname`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostname }),
  }),
  getNameservers: () => fetchJSON(`${API_BASE}/nameservers`),
  configureNameservers: (data: {
    primaryDomain: string;
    serverIp?: string;
    nameservers?: string[];
  }) => fetchJSON(`${API_BASE}/nameservers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  getPanelDomain: () => fetchJSON(`${API_BASE}/panel-domain`),
  setPanelDomain: (domain: string, enableSsl?: boolean, email?: string) =>
    fetchJSON(`${API_BASE}/panel-domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, enableSsl, email }),
    }),
};
