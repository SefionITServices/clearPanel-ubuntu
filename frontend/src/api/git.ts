// Git API client

const API_BASE = '/api/git';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

function post<T = any>(url: string, body: unknown): Promise<T> {
  return fetchJSON(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitStatus {
  success: boolean;
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface Commit {
  hash: string;
  short: string;
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  refs: string;
}

export interface BranchInfo {
  success: boolean;
  current: string;
  local: string[];
  remote: string[];
}

export interface RemoteMap {
  success: boolean;
  remotes: Record<string, { fetch: string; push: string }>;
}

export interface StashEntry {
  ref: string;
  subject: string;
  date: string;
}

// ─── API Object ───────────────────────────────────────────────────────────────

export const gitApi = {
  // ── Repo ──────────────────────────────────────────────────────────────────

  isRepo: (path: string) =>
    fetchJSON<{ success: boolean; isRepo: boolean }>(`${API_BASE}/is-repo?path=${encodeURIComponent(path)}`),

  status: (path: string) =>
    fetchJSON<GitStatus>(`${API_BASE}/status?path=${encodeURIComponent(path)}`),

  // ── Init / Clone ──────────────────────────────────────────────────────────

  init: (path: string) =>
    post(`${API_BASE}/init`, { path }),

  clone: (url: string, dest: string, name?: string) =>
    post(`${API_BASE}/clone`, { url, dest, name }),

  // ── Staging ───────────────────────────────────────────────────────────────

  add: (path: string, files: string[] = []) =>
    post(`${API_BASE}/add`, { path, files }),

  unstage: (path: string, files: string[] = []) =>
    post(`${API_BASE}/unstage`, { path, files }),

  discard: (path: string, files: string[]) =>
    post(`${API_BASE}/discard`, { path, files }),

  // ── Commit ────────────────────────────────────────────────────────────────

  commit: (path: string, message: string, authorName?: string, authorEmail?: string) =>
    post(`${API_BASE}/commit`, { path, message, authorName, authorEmail }),

  // ── Log ───────────────────────────────────────────────────────────────────

  log: (path: string, limit = 50, branch?: string) => {
    const params = new URLSearchParams({ path, limit: String(limit) });
    if (branch) params.set('branch', branch);
    return fetchJSON<{ success: boolean; commits: Commit[] }>(`${API_BASE}/log?${params}`);
  },

  // ── Diff ─────────────────────────────────────────────────────────────────

  diff: (path: string, file?: string) => {
    const params = new URLSearchParams({ path });
    if (file) params.set('file', file);
    return fetchJSON<{ success: boolean; diff: string }>(`${API_BASE}/diff?${params}`);
  },

  diffStaged: (path: string, file?: string) => {
    const params = new URLSearchParams({ path });
    if (file) params.set('file', file);
    return fetchJSON<{ success: boolean; diff: string }>(`${API_BASE}/diff-staged?${params}`);
  },

  diffCommit: (path: string, hash: string) =>
    fetchJSON<{ success: boolean; diff: string }>(
      `${API_BASE}/diff-commit?path=${encodeURIComponent(path)}&hash=${encodeURIComponent(hash)}`,
    ),

  // ── Branches ─────────────────────────────────────────────────────────────

  branches: (path: string) =>
    fetchJSON<BranchInfo>(`${API_BASE}/branches?path=${encodeURIComponent(path)}`),

  checkout: (path: string, branch: string) =>
    post(`${API_BASE}/checkout`, { path, branch }),

  createBranch: (path: string, branch: string, from?: string) =>
    post(`${API_BASE}/create-branch`, { path, branch, from }),

  deleteBranch: (path: string, branch: string, force = false) =>
    post(`${API_BASE}/delete-branch`, { path, branch, force }),

  merge: (path: string, branch: string) =>
    post(`${API_BASE}/merge`, { path, branch }),

  // ── Remotes ──────────────────────────────────────────────────────────────

  remotes: (path: string) =>
    fetchJSON<RemoteMap>(`${API_BASE}/remotes?path=${encodeURIComponent(path)}`),

  addRemote: (path: string, name: string, url: string) =>
    post(`${API_BASE}/add-remote`, { path, name, url }),

  removeRemote: (path: string, name: string) =>
    post(`${API_BASE}/remove-remote`, { path, name }),

  // ── Pull / Push / Fetch ──────────────────────────────────────────────────

  pull: (path: string, remote = 'origin', branch?: string) =>
    post<{ success: boolean; output: string }>(`${API_BASE}/pull`, { path, remote, branch }),

  push: (path: string, remote = 'origin', branch?: string, force = false) =>
    post<{ success: boolean; output: string }>(`${API_BASE}/push`, { path, remote, branch, force }),

  fetch: (path: string, remote = 'origin') =>
    post(`${API_BASE}/fetch`, { path, remote }),

  // ── Stash ─────────────────────────────────────────────────────────────────

  stash: (path: string, message?: string) =>
    post(`${API_BASE}/stash`, { path, message }),

  stashList: (path: string) =>
    fetchJSON<{ success: boolean; stashes: StashEntry[] }>(
      `${API_BASE}/stash-list?path=${encodeURIComponent(path)}`,
    ),

  stashPop: (path: string, ref?: string) =>
    post(`${API_BASE}/stash-pop`, { path, ref }),

  stashDrop: (path: string, ref?: string) =>
    post(`${API_BASE}/stash-drop`, { path, ref }),

  // ── Config ────────────────────────────────────────────────────────────────

  getConfig: (path: string) =>
    fetchJSON<{ success: boolean; name: string; email: string }>(
      `${API_BASE}/config?path=${encodeURIComponent(path)}`,
    ),

  setConfig: (path: string, name: string, email: string) =>
    post(`${API_BASE}/config`, { path, name, email }),

  // ── HTTPS credentials ─────────────────────────────────────────────────────

  setCred: (path: string, username: string, token: string) =>
    post(`${API_BASE}/set-cred`, { path, username, token }),

  removeCred: (path: string) =>
    post(`${API_BASE}/remove-cred`, { path }),
};
