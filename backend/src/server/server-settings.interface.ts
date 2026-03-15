export interface ServerSettings {
  hostname?: string;
  primaryDomain?: string;
  serverIp?: string;
  nameservers: string[];
  webmailUrl?: string;
  panelDomain?: string;
  panelSsl?: boolean;
  updatedAt?: string;
}
