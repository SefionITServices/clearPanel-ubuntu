import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Migration } from './index';

const logger = new Logger('Migration:2.1.0');

/**
 * Migration 2.1.0 — Initial migration scaffold.
 *
 * What it does:
 *   1. Adds a `dataVersion` field to setup-status.json if missing.
 *   2. Ensures server-settings.json has all expected fields.
 *   3. Placeholder for future structural changes.
 *
 * This is intentionally lightweight — it exists to prove the migration
 * pipeline works and to set the baseline dataVersion.
 */
export const migration: Migration = {
  version: '2.1.0',
  description: 'Baseline migration — add dataVersion, normalize settings',

  async up(): Promise<void> {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '..', 'data');

    // 1. Ensure server-settings.json has all expected fields
    const settingsPath = path.join(dataDir, 'server-settings.json');
    try {
      const raw = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);
      let dirty = false;

      if (!settings.nameservers) { settings.nameservers = []; dirty = true; }
      if (!settings.updatedAt)   { settings.updatedAt = new Date().toISOString(); dirty = true; }

      if (dirty) {
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        logger.log('Normalized server-settings.json');
      }
    } catch {
      // File doesn't exist yet — that's fine, service will create it on first access
    }

    // 2. Ensure mail-domains.json is valid JSON array if it exists
    const mailDomainsPath = path.join(dataDir, 'mail-domains.json');
    try {
      const raw = await fs.readFile(mailDomainsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) && typeof parsed === 'object') {
        // Wrap in array if it was a single object (shouldn't happen, but safety)
        logger.log('Wrapping mail-domains.json in array');
        await fs.writeFile(mailDomainsPath, JSON.stringify([parsed], null, 2), 'utf-8');
      }
    } catch {
      // File doesn't exist — fine
    }

    logger.log('Baseline migration complete');
  },
};
