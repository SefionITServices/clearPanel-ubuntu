// Terminal API client

const API_BASE = '/api/terminal';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const terminalApi = {
  getInfo: (sessionId?: string) =>
    fetchJSON(`${API_BASE}/info${sessionId ? `?sessionId=${sessionId}` : ''}`),
  exec: (command: string, sessionId?: string) => fetchJSON(`${API_BASE}/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, sessionId }),
  }),
};
