// SSH Keys API client

const API_BASE = '/api/ssh-keys';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const sshKeysApi = {
  list: () => fetchJSON(`${API_BASE}`),

  generate: (opts: {
    name?: string;
    algorithm?: 'ed25519' | 'rsa' | 'ecdsa';
    bits?: number;
    comment?: string;
    passphrase?: string;
  }) =>
    fetchJSON(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }),

  delete: (name: string) =>
    fetchJSON(`${API_BASE}/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  getPublicKey: (name: string) =>
    fetchJSON(`${API_BASE}/${encodeURIComponent(name)}/public`),

  getAuthorizedKeys: () => fetchJSON(`${API_BASE}/authorized`),

  addAuthorizedKey: (publicKey: string) =>
    fetchJSON(`${API_BASE}/authorized`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey }),
    }),

  removeAuthorizedKey: (index: number) =>
    fetchJSON(`${API_BASE}/authorized/${index}`, { method: 'DELETE' }),
};
