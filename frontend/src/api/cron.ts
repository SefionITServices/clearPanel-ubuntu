// Cron Jobs API client

const API_BASE = '/api/cron';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const cronApi = {
  list: () => fetchJSON(`${API_BASE}`),

  add: (schedule: string, command: string) =>
    fetchJSON(`${API_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule, command }),
    }),

  update: (id: number, schedule: string, command: string) =>
    fetchJSON(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule, command }),
    }),

  delete: (id: number) =>
    fetchJSON(`${API_BASE}/${id}`, { method: 'DELETE' }),

  toggle: (id: number, enable: boolean) =>
    fetchJSON(`${API_BASE}/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable }),
    }),

  getRaw: () => fetchJSON(`${API_BASE}/raw`),

  saveRaw: (content: string) =>
    fetchJSON(`${API_BASE}/raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),
};
