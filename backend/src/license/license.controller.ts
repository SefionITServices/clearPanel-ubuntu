import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LicenseService } from './license.service';

@Controller('license')
@UseGuards(AuthGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  /** GET /api/license — Current license status */
  @Get()
  async getStatus() {
    return this.licenseService.getLicenseInfo();
  }

  /** POST /api/license/activate — Activate a license key */
  @Post('activate')
  async activate(@Body() body: { key: string }) {
    if (!body.key?.trim()) {
      return { success: false, message: 'License key is required' };
    }
    return this.licenseService.activateLicense(body.key);
  }

  /** DELETE /api/license — Deactivate current license */
  @Delete()
  async deactivate() {
    return this.licenseService.deactivateLicense();
  }

  /** GET /api/license/update — Check for available updates */
  @Get('update')
  async checkUpdate() {
    return this.licenseService.checkForUpdate();
  }

  /** POST /api/license/start-update — Kick off a background update */
  @Post('start-update')
  async startUpdate() {
    return this.licenseService.startUpdate();
  }

  /** GET /api/license/update-progress — Poll current update progress */
  @Get('update-progress')
  async getUpdateProgress() {
    return this.licenseService.getUpdateProgress();
  }
}
