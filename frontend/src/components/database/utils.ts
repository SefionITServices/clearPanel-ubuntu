export interface DbInfo {
  name: string;
  size: number;
  tables: number;
}

export interface DbUser {
  user: string;
  host: string;
  databases: string[];
}

export interface TableInfo {
  name: string;
  rows: number;
  size: number;
  engine: string;
}

export interface EngineInfo {
  engine: string;
  label: string;
  installed: boolean;
  running: boolean;
  version: string;
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

export function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => chars[v % chars.length]).join('');
}
