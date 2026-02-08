export interface SetupConfig {
  // Mandatory fields
  adminUsername: string;
  adminPassword: string;
  serverIp: string;
  primaryDomain?: string;
  
  // Optional fields
  sessionSecret?: string;  // Auto-generated if not provided
  nameservers?: string[];
  hostname?: string;        // VPS hostname
  
  // Paths
  rootPath?: string;       // Default: /opt/clearpanel/data
  
  // Advanced settings
  port?: number;           // Default: 3334
  maxFileSize?: number;    // Default: 104857600 (100MB)
}

export interface SetupStatus {
  completed: boolean;
  completedAt?: string;
  version?: string;
  migrated?: boolean;
  adminUsername?: string;
  primaryDomain?: string;
}

export interface SetupValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SetupCompleteResponse {
  success: boolean;
  message: string;
  errors?: string[];
  details?: {
    userHome?: string;
    primaryDomainConfigured?: boolean;
    nameserversConfigured?: string[];
    loginUrl?: string;
  };
}
