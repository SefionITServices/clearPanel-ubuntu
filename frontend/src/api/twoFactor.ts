const BASE = '/api/two-factor';

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const twoFactorApi = {
  getStatus:     ()                => fetchJSON(`${BASE}/status`),
  setup:         ()                => fetchJSON(`${BASE}/setup`, { method: 'POST' }),
  enable:        (token: string)   => fetchJSON(`${BASE}/enable`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }),
  disable:       (password: string)=> fetchJSON(`${BASE}/disable`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }),
  verify:        (token: string)   => fetchJSON(`${BASE}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }),
  regenerateCodes: ()              => fetchJSON(`${BASE}/recovery-codes`, { method: 'POST' }),
};
