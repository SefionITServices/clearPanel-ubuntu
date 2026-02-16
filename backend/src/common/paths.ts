import * as path from 'path';

/**
 * Resolve the current DATA_DIR at call time (not module load time).
 * This ensures that if setup.service.ts sets process.env.DATA_DIR mid-process,
 * subsequent calls pick up the new value.
 */
export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), '..', 'data');
}

/**
 * Get the full path to a data file inside DATA_DIR.
 */
export function getDataFilePath(filename: string): string {
  return path.join(getDataDir(), filename);
}

/**
 * Resolve the mail-state directory.
 *   production  → /etc/clearpanel/mail
 *   development → <repo>/backend/mail-state
 */
export function getMailStateDir(): string {
  const mode = process.env.MAIL_MODE || process.env.NODE_ENV;
  if (mode === 'production') {
    return '/etc/clearpanel/mail';
  }
  return path.join(process.cwd(), '..', 'backend', 'mail-state');
}

/**
 * Get the full path to a file inside the mail-state directory.
 */
export function getMailStateFilePath(filename: string): string {
  return path.join(getMailStateDir(), filename);
}

/**
 * Resolve the mail-policies directory.
 *   production  → DATA_DIR/mail-policies
 *   development → <repo>/backend/mail-policies
 */
export function getMailPoliciesDir(): string {
  const mode = process.env.MAIL_MODE || process.env.NODE_ENV;
  if (mode === 'production') {
    return path.join(getDataDir(), 'mail-policies');
  }
  return path.join(process.cwd(), '..', 'backend', 'mail-policies');
}
