import { Controller, Get, Post, Delete, Param, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppStoreService } from './app-store.service';

@Controller('app-store')
export class AppStoreController {
  constructor(private readonly appStore: AppStoreService) {}

  private ensureAuth(req: Request, res: Response) {
    if (!(req.session as any)?.isAuthenticated) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  /** Get all apps with their statuses */
  @Get('apps')
  async getAllApps(@Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
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
    if (!this.ensureAuth(req, res)) return;
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
    if (!this.ensureAuth(req, res)) return;
    try {
      const status = await this.appStore.getAppStatus(id);
      return res.json({ success: true, status });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  /** Install an app */
  @Post('install/:id')
  async installApp(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
    try {
      const result = await this.appStore.installApp(id);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Uninstall an app */
  @Delete('uninstall/:id')
  async uninstallApp(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    if (!this.ensureAuth(req, res)) return;
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
    if (!this.ensureAuth(req, res)) return;
    try {
      const result = await this.appStore.reconfigurePhpMyAdmin();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
