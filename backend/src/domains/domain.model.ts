export interface Domain {
  id: string;
  name: string;
  folderPath: string;
  createdAt: Date;
  nameservers?: string[];
}
