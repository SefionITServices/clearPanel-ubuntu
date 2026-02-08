import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = new Logger('SetupMigration');

/**
 * Auto-migrate existing installations
 * If .env exists but setup-status.json doesn't, mark setup as completed
 */
export async function migrateExistingInstallation(): Promise<void> {
    const envPath = path.join(process.cwd(), 'backend', '.env');
    const setupStatusPath = path.join(process.cwd(), 'setup-status.json');

    try {
        // Check if .env exists
        const envExists = await fs.access(envPath).then(() => true).catch(() => false);

        // Check if setup-status.json exists
        const setupExists = await fs.access(setupStatusPath).then(() => true).catch(() => false);

        // If .env exists but setup-status.json doesn't, this is an existing installation
        if (envExists && !setupExists) {
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

            logger.log('✅ Existing installation detected - setup marked as completed');
        }
    } catch (error) {
        logger.warn('Migration check failed:', error);
    }
}
