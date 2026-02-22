// PHP Manager API client — extracted from PhpManager.tsx

const API_BASE = '/api/php';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const phpApi = {
  versions: () => fetchJSON(`${API_BASE}/versions`),
  install: (v: string) => fetchJSON(`${API_BASE}/versions/${v}/install`, { method: 'POST' }),
  uninstall: (v: string) => fetchJSON(`${API_BASE}/versions/${v}`, { method: 'DELETE' }),
  setDefault: (v: string) => fetchJSON(`${API_BASE}/versions/${v}/default`, { method: 'POST' }),
  fpmAction: (v: string, action: string) => fetchJSON(`${API_BASE}/versions/${v}/fpm/${action}`, { method: 'POST' }),
  getConfig: (v: string) => fetchJSON(`${API_BASE}/config/${v}`),
  setConfig: (v: string, directives: Record<string, string>) =>
    fetchJSON(`${API_BASE}/config/${v}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directives }),
    }),
  extensions: (v: string) => fetchJSON(`${API_BASE}/extensions/${v}`),
  installExt: (v: string, ext: string) => fetchJSON(`${API_BASE}/extensions/${v}/${ext}`, { method: 'POST' }),
  removeExt: (v: string, ext: string) => fetchJSON(`${API_BASE}/extensions/${v}/${ext}`, { method: 'DELETE' }),
  logs: (v: string, lines = 100) => fetchJSON(`${API_BASE}/logs/${v}?lines=${lines}`),
  pools: (v: string) => fetchJSON(`${API_BASE}/pools/${v}`),
  createPool: (v: string, pool: Record<string, any>) =>
    fetchJSON(`${API_BASE}/pools/${v}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pool),
    }),
  deletePool: (v: string, name: string) => fetchJSON(`${API_BASE}/pools/${v}/${name}`, { method: 'DELETE' }),
};
