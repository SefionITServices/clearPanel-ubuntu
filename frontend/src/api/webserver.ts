// Webserver (Nginx) API client

const API_BASE = '/api/webserver';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const webserverApi = {
  status: () => fetchJSON(`${API_BASE}/status`),
  install: () => fetchJSON(`${API_BASE}/install`, { method: 'POST' }),
  createVhost: (domain: string, documentRoot: string, phpVersion?: string) =>
    fetchJSON(`${API_BASE}/vhost/${encodeURIComponent(domain)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentRoot, phpVersion }),
    }),
  removeVhost: (domain: string) =>
    fetchJSON(`${API_BASE}/vhost/${encodeURIComponent(domain)}`, { method: 'DELETE' }),
  getDnsInstructions: (domain: string) =>
    fetchJSON(`${API_BASE}/dns-instructions/${encodeURIComponent(domain)}`),
};
