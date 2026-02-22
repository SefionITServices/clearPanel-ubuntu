const BASE = '/api/processes';

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const processApi = {
  list:       (sort = 'cpu', limit = 100) => fetchJSON(`${BASE}?sort=${sort}&limit=${limit}`),
  details:    (pid: number)               => fetchJSON(`${BASE}/${pid}`),
  kill:       (pid: number, signal = 'SIGTERM') => fetchJSON(`${BASE}/${pid}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signal }) }),
  listServices: ()                        => fetchJSON(`${BASE}/services/list`),
  controlService: (name: string, action: string) => fetchJSON(`${BASE}/services/${name}/${action}`, { method: 'POST' }),
};
