export interface Notification {
  id: string;
  userId?: string;
  type?: 'system' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp
  actionUrl?: string;
}
