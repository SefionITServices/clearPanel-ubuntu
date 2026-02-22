// SSL API client

const API_BASE = '/api/ssl';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const sslApi = {
  status: () => fetchJSON(`${API_BASE}/status`),
  certificates: () => fetchJSON(`${API_BASE}/certificates`),
  installCertbot: () => fetchJSON(`${API_BASE}/install-certbot`, { method: 'POST' }),
  issueCertificate: (domain: string, email: string) => fetchJSON(`${API_BASE}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, email }),
  }),
  renewCertificate: (domain: string) => fetchJSON(`${API_BASE}/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  }),
  renewAll: () => fetchJSON(`${API_BASE}/renew-all`, { method: 'POST' }),
  deleteCertificate: (domain: string) => fetchJSON(`${API_BASE}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  }),
  logs: () => fetchJSON(`${API_BASE}/logs`),
};
