// Docker Manager API client

const BASE = '/api/docker';

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

export const dockerApi = {
  // Status
  status: () => fetchJSON(`${BASE}/status`),
  install: () => post(`${BASE}/install`),

  // Containers
  listContainers: (all = true) => fetchJSON(`${BASE}/containers?all=${all}`),
  runContainer: (payload: { name: string; image: string; ports?: string[]; env?: string[]; volumes?: string[]; restartPolicy?: string; network?: string }) =>
    post(`${BASE}/containers`, payload),
  containerAction: (id: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') =>
    post(`${BASE}/containers/${id}/${action}`),
  removeContainer: (id: string, force = false) => del(`${BASE}/containers/${id}?force=${force}`),
  containerLogs: (id: string, tail = 200) => fetchJSON(`${BASE}/containers/${id}/logs?tail=${tail}`),
  inspectContainer: (id: string) => fetchJSON(`${BASE}/containers/${id}/inspect`),
  stats: () => fetchJSON(`${BASE}/stats`),

  // Images
  listImages: () => fetchJSON(`${BASE}/images`),
  pullImage: (image: string) => post(`${BASE}/images/pull`, { image }),
  removeImage: (id: string, force = false) => del(`${BASE}/images/${id}?force=${force}`),

  // Compose stacks
  listStacks: () => fetchJSON(`${BASE}/stacks`),
  createStack: (payload: { name: string; projectPath: string; composeContent: string }) =>
    post(`${BASE}/stacks`, payload),
  deleteStack: (name: string) => del(`${BASE}/stacks/${name}`),
  composeUp: (projectPath: string) => post(`${BASE}/stacks/up`, { projectPath }),
  composeDown: (projectPath: string) => post(`${BASE}/stacks/down`, { projectPath }),
  composeLogs: (projectPath: string, tail = 100) =>
    fetchJSON(`${BASE}/stacks/logs?projectPath=${encodeURIComponent(projectPath)}&tail=${tail}`),
  getComposeFile: (projectPath: string) =>
    fetchJSON(`${BASE}/stacks/file?projectPath=${encodeURIComponent(projectPath)}`),
  saveComposeFile: (projectPath: string, content: string) =>
    post(`${BASE}/stacks/file`, { projectPath, content }),

  // Networks & Volumes
  listNetworks: () => fetchJSON(`${BASE}/networks`),
  listVolumes: () => fetchJSON(`${BASE}/volumes`),
  pruneSystem: () => post(`${BASE}/prune`),
};
