import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getDataFilePath, getDataDir } from '../common/paths';
import { migrations, Migration } from './index';

const logger = new Logger('MigrationRunner');

/**
 * Read the current data‑schema version from setup-status.json.
 * Falls back to '1.0.0' for pre-versioned installs.
 */
async function getDataVersion(): Promise<string> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '..', 'data');
  const statusPath = path.join(dataDir, 'setup-status.json');
  try {
    const raw = await fs.readFile(statusPath, 'utf-8');
    const status = JSON.parse(raw);
    return status.dataVersion || status.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Write the new dataVersion into setup-status.json (preserves all other fields).
 */
async function setDataVersion(version: string): Promise<void> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '..', 'data');
  const statusPath = path.join(dataDir, 'setup-status.json');
  let status: Record<string, any> = {};
  try {
    const raw = await fs.readFile(statusPath, 'utf-8');
    status = JSON.parse(raw);
  } catch {
    // file may not exist yet
  }
  status.dataVersion = version;
  status.lastMigrationAt = new Date().toISOString();
  await fs.mkdir(path.dirname(statusPath), { recursive: true });
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf-8');
}

/**
 * Read the panel version from backend/package.json.
 */
export function getPanelVersion(): string {
  try {
    const raw = require(path.join(process.cwd(), 'package.json'));
    return raw.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Simple semver comparison that returns -1, 0, or 1.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/**
 * Create a JSON backup of DATA_DIR before running migrations.
 */
async function backupDataDir(): Promise<string | null> {
  try {
    const dataDir = getDataDir();
    const backupRoot = path.join(process.cwd(), '..', 'backups');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(backupRoot, `pre-migration_${ts}`);
    await fs.mkdir(dest, { recursive: true });

    const files = await fs.readdir(dataDir);
    for (const file of files) {
      const src = path.join(dataDir, file);
      const stat = await fs.stat(src);
      if (stat.isFile()) {
        await fs.copyFile(src, path.join(dest, file));
      }
    }
    logger.log(`Pre-migration backup created at ${dest}`);
    return dest;
  } catch (err) {
    logger.warn(`Could not create pre-migration backup: ${err}`);
    return null;
  }
}

/**
 * Run all pending migrations between {currentDataVersion} and {panelVersion}.
 * Called once on every startup from main.ts (before NestFactory.create).
 */
export async function runPendingMigrations(): Promise<void> {
  const dataVersion = await getDataVersion();
  const panelVersion = getPanelVersion();

  // Sort migrations by version ascending
  const sorted = [...migrations].sort((a, b) => compareSemver(a.version, b.version));

  // Filter only migrations newer than the current data version
  const pending = sorted.filter(m => compareSemver(m.version, dataVersion) > 0 && compareSemver(m.version, panelVersion) <= 0);

  if (pending.length === 0) {
    logger.log(`Data version ${dataVersion} is up-to-date (panel v${panelVersion}). No migrations needed.`);
    return;
  }

  logger.log(`Running ${pending.length} migration(s): ${dataVersion} → ${panelVersion}`);

  // Backup before migration
  await backupDataDir();

  for (const migration of pending) {
    logger.log(`► Migration ${migration.version}: ${migration.description}`);
    try {
      await migration.up();
      await setDataVersion(migration.version);
      logger.log(`  ✓ Migration ${migration.version} complete`);
    } catch (err) {
      logger.error(`  ✗ Migration ${migration.version} FAILED: ${err}`);
      logger.error('Stopping migration pipeline. Panel may need manual intervention.');
      // Don't advance dataVersion — will retry on next startup
      return;
    }
  }

  logger.log(`All migrations applied. Data version now: ${panelVersion}`);
}
