// Files API client for file manager operations

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
}

export interface ListResponse {
  success: boolean;
  path: string;
  items: FileItem[];
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface UploadResult {
  name: string;
  ok: boolean;
  error?: string;
}

export interface UploadResponse extends ApiResponse {
  results?: UploadResult[];
}

export interface DeleteResult {
  path: string;
  ok: boolean;
  error?: string;
}

export interface DeleteResponse extends ApiResponse {
  results?: DeleteResult[];
}

export interface MoveResult {
  name: string;
  ok: boolean;
  error?: string;
}

export interface MoveResponse extends ApiResponse {
  results?: MoveResult[];
}

const API_BASE = '/api/files';

async function fetchJSON<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || error.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const filesAPI = {
  async list(path: string = ''): Promise<ListResponse> {
    const url = `${API_BASE}/list?path=${encodeURIComponent(path)}`;
    return fetchJSON<ListResponse>(url);
  },

  async mkdir(path: string, name: string): Promise<ApiResponse> {
    return fetchJSON<ApiResponse>(`${API_BASE}/mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    });
  },

  async delete(paths: string[]): Promise<DeleteResponse> {
    return fetchJSON<DeleteResponse>(`${API_BASE}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
  },

  async rename(path: string, newName: string): Promise<ApiResponse> {
    return fetchJSON<ApiResponse>(`${API_BASE}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, newName }),
    });
  },

  async move(paths: string[], dest: string): Promise<MoveResponse> {
    return fetchJSON<MoveResponse>(`${API_BASE}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths, dest }),
    });
  },

  async upload(destPath: string, files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('path', destPath);
    files.forEach((file) => {
      formData.append('file', file);
    });

    return fetchJSON<UploadResponse>(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  downloadURL(path: string): string {
    return `${API_BASE}/download?path=${encodeURIComponent(path)}`;
  },

  async archive(paths: string[], name: string = 'archive.zip'): Promise<Blob> {
    const res = await fetch(`${API_BASE}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paths, name }),
    });
    if (!res.ok) {
      throw new Error(`Archive failed: ${res.status}`);
    }
    return res.blob();
  },
};
