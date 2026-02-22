import {
  Controller, Get, Post, Delete, Put, Body, Param, Query,
  Req, Res, HttpStatus, UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PhpService } from './php.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('php')
@UseGuards(AuthGuard)
export class PhpController {
  constructor(private readonly php: PhpService) {}

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  VERSION MANAGER
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('versions')
  async listVersions(@Req() req: Request, @Res() res: Response) {
    try {
      const versions = await this.php.listVersions();
      const defaultVersion = await this.php.getDefaultVersion();
      return res.json({ success: true, versions, defaultVersion });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('versions/:version/install')
  async installVersion(@Param('version') version: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.php.installVersion(version);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Delete('versions/:version')
  async uninstallVersion(@Param('version') version: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.php.uninstallVersion(version);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('versions/:version/default')
  async setDefault(@Param('version') version: string, @Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.php.setDefaultVersion(version);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('versions/:version/fpm/:action')
  async controlFpm(
    @Param('version') version: string,
    @Param('action') action: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const valid = ['start', 'stop', 'restart', 'enable', 'disable'];
    if (!valid.includes(action)) {
      return res.status(400).json({ success: false, error: `Invalid action. Use: ${valid.join(', ')}` });
    }
    try {
      const result = await this.php.controlFpm(version, action as any);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  CONFIGURATION EDITOR
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('config/:version')
  async getConfig(
    @Param('version') version: string,
    @Query('sapi') sapi: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const config = await this.php.getConfig(version, (sapi as any) || 'fpm');
      return res.json({ success: true, config });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Put('config/:version')
  async setConfig(
    @Param('version') version: string,
    @Body() body: { sapi?: string; directives: Record<string, string> },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.directives || typeof body.directives !== 'object') {
      return res.status(400).json({ success: false, error: 'directives object required' });
    }
    try {
      const result = await this.php.setConfig(version, (body.sapi as any) || 'fpm', body.directives);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  EXTENSIONS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('extensions/:version')
  async listExtensions(@Param('version') version: string, @Req() req: Request, @Res() res: Response) {
    try {
      const extensions = await this.php.listExtensions(version);
      return res.json({ success: true, extensions });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('extensions/:version/:ext')
  async installExtension(
    @Param('version') version: string,
    @Param('ext') ext: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.php.installExtension(version, ext);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Delete('extensions/:version/:ext')
  async removeExtension(
    @Param('version') version: string,
    @Param('ext') ext: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.php.removeExtension(version, ext);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  FPM POOLS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('pools/:version')
  async listPools(@Param('version') version: string, @Req() req: Request, @Res() res: Response) {
    try {
      const pools = await this.php.listPools(version);
      return res.json({ success: true, pools });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('pools/:version')
  async savePool(
    @Param('version') version: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.name) return res.status(400).json({ success: false, error: 'pool name required' });
    try {
      const result = await this.php.savePool(version, body);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Delete('pools/:version/:name')
  async deletePool(
    @Param('version') version: string,
    @Param('name') name: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.php.deletePool(version, name);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  ERROR LOGS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('logs/:version')
  async getErrorLog(
    @Param('version') version: string,
    @Query('lines') lines: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.php.getErrorLog(version, parseInt(lines, 10) || 100);
      return res.json({ success: true, ...result });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
