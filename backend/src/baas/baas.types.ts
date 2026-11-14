export type BaasStatus = 'running' | 'stopped' | 'error' | 'installing';

export interface BaasInstance {
  id: string;
  name: string;
  port: number;
  domain?: string;
  status: BaasStatus;
  dataPath: string;
  adminUrl: string;
  apiUrl: string;
  adminEmail?: string;
  createdAt: string;
  version?: string;
  pid?: number;
  memoryUsageMb?: number;
}

export interface CreateBaasDto {
  name: string;
  port?: number;
  domain?: string;
  adminEmail: string;
  adminPassword?: string;
}

export interface BaasSdkSnippet {
  language: 'javascript' | 'flutter' | 'python' | 'curl';
  label: string;
  code: string;
}

export interface BaasOverviewStats {
  installed: boolean;
  pocketbaseVersion?: string;
  totalInstances: number;
  runningInstances: number;
}
