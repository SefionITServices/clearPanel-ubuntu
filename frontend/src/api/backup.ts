const BASE = '/api/backup';

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const backupApi = {
  list: ()                       => fetchJSON(BASE),
  create: (type: string)         => fetchJSON(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) }),
  restore: (filename: string)    => fetchJSON(`${BASE}/${filename}/restore`, { method: 'POST' }),
  delete: (filename: string)     => fetchJSON(`${BASE}/${filename}`, { method: 'DELETE' }),
  downloadUrl: (filename: string) => `${BASE}/${filename}/download`,
  getSchedule: ()                => fetchJSON(`${BASE}/schedule`),
  saveSchedule: (schedule: any)  => fetchJSON(`${BASE}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedule) }),
};
