export interface Mailbox {
  id: string;
  email: string;
  passwordHash: string;
  quotaMb?: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MailAlias {
  id: string;
  source: string;
  destination: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MailDomain {
  id: string;
  domain: string;
  enabled: boolean;
  spamThreshold?: number;
  greylistingEnabled?: boolean;
  greylistingDelaySeconds?: number;
  virusScanEnabled?: boolean;
  dkimSelector?: string;
  dkimPublicKey?: string;
  dkimUpdatedAt?: string;
  createdAt: string;
  updatedAt?: string;
  mailboxes: Mailbox[];
  aliases: MailAlias[];
}
