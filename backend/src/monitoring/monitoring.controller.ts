import {
  Controller, Get, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MonitoringService } from './monitoring.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('monitoring')
@UseGuards(AuthGuard)
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get()
  async getOverview(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.monitoring.getOverview();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('cpu')
  async getCpu(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.monitoring.getCpu();
      return res.json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('memory')
  async getMemory(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.monitoring.getMemory();
      return res.json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('disks')
  async getDisks(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.monitoring.getDisks();
      return res.json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('network')
  async getNetwork(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.monitoring.getNetwork();
      return res.json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('services')
  async getServices(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.monitoring.getServices();
      return res.json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('processes')
  async getProcesses(
    @Query('limit') limit: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const n = parseInt(limit, 10) || 15;
      const data = await this.monitoring.getTopProcesses(n);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
