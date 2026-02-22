/**
 * Migration registry — import each migration and add it to the array.
 *
 * Each migration must satisfy the Migration interface:
 *   { version: string; description: string; up(): Promise<void>; }
 *
 * Migrations run in semver order. Each one runs exactly once (tracked by
 * dataVersion in setup-status.json). They must be **idempotent** — re-running
 * a migration on already-migrated data should be a no-op.
 */

export interface Migration {
  /** Semver this migration upgrades data TO (e.g. '2.1.0') */
  version: string;
  /** Human-readable description */
  description: string;
  /** Forward migration */
  up(): Promise<void>;
}

// ─── Register migrations here (import and add to array) ─────────────
import { migration as m2_1_0 } from './2.1.0';

export const migrations: Migration[] = [
  m2_1_0,
];
