import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  Req, Res, UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CronService } from './cron.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('cron')
@UseGuards(AuthGuard)
export class CronController {
  constructor(private readonly cron: CronService) {}

  // ─── List all cron jobs ───────────────────────────────────────────

  @Get()
  async listJobs(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.cron.listJobs();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── Add a cron job ───────────────────────────────────────────────

  @Post()
  async addJob(
    @Body() body: { schedule: string; command: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.schedule?.trim() || !body.command?.trim()) {
      return res.status(400).json({ success: false, error: 'schedule and command are required' });
    }
    try {
      const result = await this.cron.addJob(body.schedule, body.command);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── Update a cron job ────────────────────────────────────────────

  @Put(':id')
  async updateJob(
    @Param('id') id: string,
    @Body() body: { schedule: string; command: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.schedule?.trim() || !body.command?.trim()) {
      return res.status(400).json({ success: false, error: 'schedule and command are required' });
    }
    try {
      const result = await this.cron.updateJob(parseInt(id, 10), body.schedule, body.command);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── Delete a cron job ────────────────────────────────────────────

  @Delete(':id')
  async deleteJob(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.cron.deleteJob(parseInt(id, 10));
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── Toggle enable/disable ────────────────────────────────────────

  @Post(':id/toggle')
  async toggleJob(
    @Param('id') id: string,
    @Body() body: { enable: boolean },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.cron.toggleJob(parseInt(id, 10), body.enable);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ─── Raw crontab ─────────────────────────────────────────────────

  @Get('raw')
  async getRaw(@Req() req: Request, @Res() res: Response) {
    try {
      const raw = await this.cron.getRawCrontab();
      return res.json({ success: true, content: raw });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('raw')
  async saveRaw(
    @Body() body: { content: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.cron.saveRawCrontab(body.content || '');
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
