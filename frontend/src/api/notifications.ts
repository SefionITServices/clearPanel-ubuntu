const BASE = '/api/notifications';

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const notificationsApi = {
  // unread list by default
  list: () => fetchJSON(`${BASE}?filter=unread`),
  // { count }
  getCount: () => fetchJSON(`${BASE}/count`),
  markAsRead: (id: string) => fetchJSON(`${BASE}/${id}`, { method: 'PUT' }),
  markMultipleAsRead: (ids: string[]) => fetchJSON(`${BASE}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }),
  dismiss: (id: string) => fetchJSON(`${BASE}/${id}`, { method: 'DELETE' }),
};
