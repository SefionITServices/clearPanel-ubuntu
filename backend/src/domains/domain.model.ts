export interface Domain {
  id: string;
  name: string;
  folderPath: string;
  createdAt: Date;
  nameservers?: string[];
  /** Optional per-domain PHP version, e.g. "8.1" */
  phpVersion?: string;
}
