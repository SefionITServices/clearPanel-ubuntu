// System / Processes / Monitoring API client

const BASE = '/api';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

const post = (url: string, body?: any) =>
  fetchJSON(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const del = (url: string) => fetchJSON(url, { method: 'DELETE' });

export const systemApi = {
  // Processes
  listProcesses: (sort?: string, limit?: number) => fetchJSON(`${BASE}/processes${sort ? `?sort=${encodeURIComponent(sort)}` : ''}${limit ? `${sort ? '&' : '?'}limit=${limit}` : ''}`),
  getProcessDetails: (pid: number) => fetchJSON(`${BASE}/processes/${pid}`),
  killProcess: (pid: number, signal?: string) => del(`${BASE}/processes/${pid}`),

  // Services (systemctl)
  listServices: () => fetchJSON(`${BASE}/processes/services/list`),
  controlService: (name: string, action: string) => post(`${BASE}/processes/services/${encodeURIComponent(name)}/${encodeURIComponent(action)}`),

  // Monitoring
  getMonitoringServices: () => fetchJSON(`${BASE}/monitoring/services`),
};

export default systemApi;
