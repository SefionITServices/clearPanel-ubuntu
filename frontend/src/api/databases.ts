// Database API client — extracted from Databases.tsx

const API_BASE = '/api/database';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const databaseApi = {
  status: () => fetchJSON(`${API_BASE}/status`),
  engines: () => fetchJSON(`${API_BASE}/engines`),
  install: () => fetchJSON(`${API_BASE}/install`, { method: 'POST' }),
  installEngine: (engine: string) => fetchJSON(`${API_BASE}/install/${engine}`, { method: 'POST' }),
  listDatabases: (engine?: string) => fetchJSON(`${API_BASE}/list${engine ? `?engine=${engine}` : ''}`),
  createDatabase: (name: string, engine?: string) => fetchJSON(`${API_BASE}/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, engine }),
  }),
  deleteDatabase: (name: string, engine?: string) => fetchJSON(`${API_BASE}/delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, engine }),
  }),
  listTables: (database: string, engine?: string) =>
    fetchJSON(`${API_BASE}/tables?database=${encodeURIComponent(database)}${engine ? `&engine=${engine}` : ''}`),
  listUsers: (engine?: string) => fetchJSON(`${API_BASE}/users${engine ? `?engine=${engine}` : ''}`),
  createUser: (name: string, password: string, host?: string, engine?: string) => fetchJSON(`${API_BASE}/users/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, host, engine }),
  }),
  deleteUser: (name: string, host?: string, engine?: string) => fetchJSON(`${API_BASE}/users/delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, host, engine }),
  }),
  changePassword: (name: string, password: string, host?: string, engine?: string) => fetchJSON(`${API_BASE}/users/password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, host, engine }),
  }),
  grant: (user: string, database: string, privileges?: string[], host?: string, engine?: string) =>
    fetchJSON(`${API_BASE}/privileges/grant`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, database, privileges, host, engine }),
    }),
  revoke: (user: string, database: string, host?: string, engine?: string) =>
    fetchJSON(`${API_BASE}/privileges/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, database, host, engine }),
    }),
  getPrivileges: (user: string, host?: string, engine?: string) =>
    fetchJSON(
      `${API_BASE}/privileges?user=${encodeURIComponent(user)}${host ? `&host=${encodeURIComponent(host)}` : ''}${engine ? `&engine=${engine}` : ''}`,
    ),
  exportDb: (database: string, engine?: string) =>
    fetch(`${API_BASE}/export/${encodeURIComponent(database)}${engine ? `?engine=${engine}` : ''}`, { credentials: 'include' }),
  importDb: (database: string, file?: File, sql?: string, engine?: string) => {
    const fd = new FormData();
    fd.append('database', database);
    if (engine) fd.append('engine', engine);
    if (file) fd.append('file', file);
    else if (sql) fd.append('sql', sql);
    return fetchJSON(`${API_BASE}/import`, { method: 'POST', body: fd });
  },
  query: (database: string, sql: string, engine?: string) => fetchJSON(`${API_BASE}/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, sql, engine }),
  }),
  metrics: () => fetchJSON(`${API_BASE}/metrics`),
  uninstallEngine: (engine: string) => fetchJSON(`${API_BASE}/uninstall/${engine}`, { method: 'POST' }),
  startEngine: (engine: string) => fetchJSON(`${API_BASE}/engine/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine }),
  }),
  stopEngine: (engine: string) => fetchJSON(`${API_BASE}/engine/stop`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine }),
  }),
  restartEngine: (engine: string) => fetchJSON(`${API_BASE}/engine/restart`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine }),
  }),
  engineLogs: (engine: string, lines = 50) => fetchJSON(`${API_BASE}/engine/logs?engine=${engine}&lines=${lines}`),
  diagnoseEngine: (engine: string) => fetchJSON(`${API_BASE}/engine/diagnose?engine=${engine}`),
  remoteAccess: () => fetchJSON(`${API_BASE}/remote-access`),
  setRemoteAccess: (engine: string, enabled: boolean) => fetchJSON(`${API_BASE}/remote-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine, enabled }),
  }),
  connectionInfo: () => fetchJSON(`${API_BASE}/connection-info`),
  repairTable: (database: string, table: string) => fetchJSON(`${API_BASE}/tables/repair`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, table }),
  }),
  optimizeTable: (database: string, table: string) => fetchJSON(`${API_BASE}/tables/optimize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, table }),
  }),
  checkTable: (database: string, table: string) => fetchJSON(`${API_BASE}/tables/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, table }),
  }),
};
