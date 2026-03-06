import { Controller, Get, Post, Delete, Param, Req, Res, Body, HttpStatus, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppStoreService } from './app-store.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('app-store')
@UseGuards(AuthGuard)
export class AppStoreController {
  constructor(private readonly appStore: AppStoreService) {}

  /** Get all apps with their statuses */
  @Get('apps')
  async getAllApps(@Req() req: Request, @Res() res: Response) {
    try {
      const apps = await this.appStore.getAllApps();
      return res.json({ success: true, apps });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Get catalog (definitions only, no status checks — faster) */
  @Get('catalog')
  async getCatalog(@Req() req: Request, @Res() res: Response) {
    try {
      const catalog = this.appStore.getCatalog();
      return res.json({ success: true, catalog });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Get status of a single app */
  @Get('status/:id')
  async getAppStatus(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const status = await this.appStore.getAppStatus(id);
      return res.json({ success: true, status });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  /** Install an app */
  @Post('install/:id')
  async installApp(@Param('id') id: string, @Body() body: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.appStore.installApp(id, body ?? {});
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Uninstall an app */
  @Delete('uninstall/:id')
  async uninstallApp(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.appStore.uninstallApp(id);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Reconfigure phpMyAdmin nginx (fix 502 without reinstalling) */
  @Post('reconfigure/phpmyadmin')
  async reconfigurePhpMyAdmin(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.appStore.reconfigurePhpMyAdmin();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Diagnose any app — check all dependent services */
  @Get('diagnose/:id')
  async diagnoseApp(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.appStore.diagnoseApp(id);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Repair an app — run auto-fix script */
  @Post('repair/:id')
  async repairApp(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.appStore.repairApp(id);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
