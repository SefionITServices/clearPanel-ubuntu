// Monitoring API client

const API_BASE = '/api/monitoring';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const monitoringApi = {
  getOverview: () => fetchJSON(`${API_BASE}`),
  getCpu: () => fetchJSON(`${API_BASE}/cpu`),
  getMemory: () => fetchJSON(`${API_BASE}/memory`),
  getDisks: () => fetchJSON(`${API_BASE}/disks`),
  getNetwork: () => fetchJSON(`${API_BASE}/network`),
  getServices: () => fetchJSON(`${API_BASE}/services`),
  getProcesses: (limit?: number) => fetchJSON(`${API_BASE}/processes${limit ? `?limit=${limit}` : ''}`),
};
