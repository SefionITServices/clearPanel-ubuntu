// Firewall API client

const API_BASE = '/api/firewall';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const firewallApi = {
  getStatus: () => fetchJSON(`${API_BASE}`),

  install: () => fetchJSON(`${API_BASE}/install`, { method: 'POST' }),

  enable: () => fetchJSON(`${API_BASE}/enable`, { method: 'POST' }),

  disable: () => fetchJSON(`${API_BASE}/disable`, { method: 'POST' }),

  addRule: (opts: {
    action: 'allow' | 'deny' | 'reject' | 'limit';
    port?: string;
    protocol?: 'tcp' | 'udp' | 'any';
    from?: string;
    to?: string;
    comment?: string;
  }) =>
    fetchJSON(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }),

  deleteRule: (id: number) =>
    fetchJSON(`${API_BASE}/rules/${id}`, { method: 'DELETE' }),

  setDefault: (direction: 'incoming' | 'outgoing', policy: 'allow' | 'deny' | 'reject') =>
    fetchJSON(`${API_BASE}/default`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, policy }),
    }),

  reset: () => fetchJSON(`${API_BASE}/reset`, { method: 'POST' }),

  applyPreset: (name: string) =>
    fetchJSON(`${API_BASE}/preset/${name}`, { method: 'POST' }),

  getFail2Ban: () => fetchJSON(`${API_BASE}/fail2ban`),
};
