import { Body, Controller, Get, Post, HttpException, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';
import { SetupService } from './setup.service';
import { SetupConfig } from './setup.model';

@Controller('setup')
export class SetupController {
    constructor(private readonly setupService: SetupService) { }

    /**
     * GET /api/setup/status
     * Check if setup is completed
     */
    @Get('status')
    async getStatus() {
        const status = await this.setupService.getSetupStatus();
        return {
            completed: status.completed,
            completedAt: status.completedAt,
            version: status.version,
        };
    }

    /**
     * POST /api/setup/complete
     * Submit setup configuration
     */
    @Post('complete')
    async completeSetup(@Body() config: SetupConfig, @Req() req: Request) {
        // Verify setup is not already completed
        const isCompleted = await this.setupService.isSetupCompleted();
        if (isCompleted) {
            throw new HttpException(
                'Setup has already been completed',
                HttpStatus.FORBIDDEN,
            );
        }

        const result = await this.setupService.completeSetup(config);

        if (!result.success) {
            throw new HttpException(
                {
                    message: result.message,
                    errors: result.errors,
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        // Auto-login the user with the credentials they just created
        (req.session as any).isAuthenticated = true;
        (req.session as any).username = config.adminUsername;

        // Save session explicitly before scheduling restart
        await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.warn('[Setup] Session save warning:', err);
                }
                resolve();
            });
        });

        // Schedule a graceful restart so ConfigModule re-reads the new .env
        // Use a longer delay (5s) to ensure the HTTP response fully reaches
        // the client through Nginx reverse proxy before the process exits.
        setTimeout(() => {
            console.log('[Setup] Restarting process to apply new environment...');
            process.exit(0); // systemd will restart us automatically
        }, 5000);

        return result;
    }

    /**
     * POST /api/setup/validate
     * Validate configuration without saving
     */
    @Post('validate')
    async validateConfig(@Body() config: SetupConfig) {
        const validation = this.setupService.validateConfig(config);
        return validation;
    }

    /**
     * GET /api/setup/detect-ip
     * Auto-detect server IP
     */
    @Get('detect-ip')
    async detectServerIp() {
        const ip = await this.setupService.detectServerIp();
        return {
            ip: ip || null,
            detected: !!ip,
        };
    }
}
