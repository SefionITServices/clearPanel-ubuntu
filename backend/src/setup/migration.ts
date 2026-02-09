import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = new Logger('SetupMigration');

/**
 * Auto-migrate existing installations that were set up BEFORE the wizard existed.
 * Only marks setup complete if .env has ADMIN_USERNAME set (meaning a real config was done).
 * A minimal .env (without ADMIN_USERNAME) from install.sh does NOT trigger migration.
 */
export async function migrateExistingInstallation(): Promise<void> {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), '..', 'data');
    const envPath = path.join(process.cwd(), '.env');
    const setupStatusPath = path.join(dataDir, 'setup-status.json');

    try {
        // Check if setup-status.json already exists
        const setupExists = await fs.access(setupStatusPath).then(() => true).catch(() => false);
        if (setupExists) return; // Already decided

        // Check if .env exists with ADMIN_USERNAME (real config, not minimal boot env)
        let envHasCredentials = false;
        try {
            const envContent = await fs.readFile(envPath, 'utf-8');
            envHasCredentials = /^ADMIN_USERNAME=/m.test(envContent);
        } catch {
            // No .env at all — wizard needs to run
            return;
        }

        // Only auto-complete setup if this was a pre-wizard installation with real credentials
        if (envHasCredentials) {
            await fs.mkdir(dataDir, { recursive: true });
            const setupStatus = {
                completed: true,
                completedAt: new Date().toISOString(),
                version: '1.0.0',
                migrated: true,
            };

            await fs.writeFile(
                setupStatusPath,
                JSON.stringify(setupStatus, null, 2),
                'utf-8',
            );

            logger.log('Existing installation detected (has ADMIN_USERNAME) - setup marked as completed');
        }
    } catch (error) {
        logger.warn('Migration check failed:', error);
    }
}
