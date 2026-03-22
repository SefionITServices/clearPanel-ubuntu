// Project Detector API client

export type ProjectType =
  | 'docker-compose'
  | 'docker'
  | 'nextjs'
  | 'nodejs'
  | 'python'
  | 'laravel'
  | 'php'
  | 'static'
  | 'unknown';

export interface EnvVar {
  key: string;
  value: string;
  isExample: boolean;
}

export interface ProjectDetection {
  success: boolean;
  type: ProjectType;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  portHint?: number;
  startCommand?: string;
  buildCommand?: string;
  envFiles: string[];
  envVars: EnvVar[];
  dockerServices?: string[];
  hasDockerfile: boolean;
  packageName?: string;
  folderPath?: string;
}

const API_BASE = '/api/project-detector';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const projectDetectorApi = {
  scanDomain: (domain: string): Promise<ProjectDetection> =>
    fetchJSON(`${API_BASE}/scan-domain?domain=${encodeURIComponent(domain)}`),

  scanPath: (folderPath: string): Promise<ProjectDetection> =>
    fetchJSON(`${API_BASE}/scan?path=${encodeURIComponent(folderPath)}`),

  runCommand: (folderPath: string, command: string): Promise<{ success: boolean; output?: string; error?: string }> =>
    fetchJSON(`${API_BASE}/run-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, command }),
    }),
};
