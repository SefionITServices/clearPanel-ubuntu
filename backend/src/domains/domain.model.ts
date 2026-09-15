export interface Domain {
  id: string;
  name: string;
  folderPath: string;
  createdAt: Date;
  nameservers?: string[];
  /** Optional per-domain PHP version, e.g. "8.1" */
  phpVersion?: string;
  // Optional reverse-proxy linkage metadata
  linkedAppId?: string;
  linkedAppName?: string;
  linkedAppPort?: number;
  linkedContainerId?: string;
  linkedContainerName?: string;
  linkedContainerPort?: number;
  // Upstream host for proxy_pass (defaults to 127.0.0.1)
  proxyHost?: string;
}
