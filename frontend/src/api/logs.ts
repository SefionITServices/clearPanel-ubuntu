// Logs API client

export interface LogSource {
  id: string;
  label: string;
  category: string;
}

export interface LogResult {
  source: string;
  label: string;
  lines: string[];
  truncated: boolean;
  timestamp: string;
}

const API_BASE = '/api/logs';

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export const logsApi = {
  getSources(): Promise<LogSource[]> {
    return fetchJSON<LogSource[]>(`${API_BASE}/sources`);
  },

  getLog(sourceId: string, lines = 100): Promise<LogResult> {
    return fetchJSON<LogResult>(`${API_BASE}/${encodeURIComponent(sourceId)}?lines=${lines}`);
  },
};
