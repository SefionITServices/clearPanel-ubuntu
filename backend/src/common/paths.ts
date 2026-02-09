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
