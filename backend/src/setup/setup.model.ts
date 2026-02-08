export interface SetupConfig {
  // Mandatory fields
  adminUsername: string;
  adminPassword: string;
  serverIp: string;
  primaryDomain?: string;
  
  // Optional fields
  sessionSecret?: string;  // Auto-generated if not provided
  nameservers?: string[];
  
  // Paths
  rootPath?: string;       // Default: /opt/clearpanel/data
  domainsRoot?: string;    // Default: ~/clearpanel-domains
  
  // Advanced settings
  port?: number;           // Default: 3334
  maxFileSize?: number;    // Default: 104857600 (100MB)
}

export interface SetupStatus {
  completed: boolean;
  completedAt?: string;
  version?: string;
  migrated?: boolean;
}

export interface SetupValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SetupCompleteResponse {
  success: boolean;
  message: string;
  errors?: string[];
}
