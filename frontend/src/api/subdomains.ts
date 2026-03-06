// Subdomains API client

const API_BASE = '/api/subdomains';

async function fetchJSON<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface SubdomainRecord {
  id: string;
  name: string;
  folderPath: string;
  parentDomain: string;
  createdAt: string;
  phpVersion?: string;
  nameservers?: string[];
}

export const subdomainsApi = {
  list: () => fetchJSON<SubdomainRecord[]>(API_BASE),

  create: (data: {
    prefix: string;
    parentDomain: string;
    folderPath?: string;
    pathMode?: string;
    phpVersion?: string;
  }) =>
    fetchJSON(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchJSON(`${API_BASE}/${id}`, { method: 'DELETE' }),
};
