import {
  Controller, Get, Post, Delete, Body, Param, Query,
  Req, Res, UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FirewallService } from './firewall.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('firewall')
@UseGuards(AuthGuard)
export class FirewallController {
  constructor(private readonly firewall: FirewallService) {}

  @Get()
  async getStatus(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.firewall.getStatus();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('install')
  async install(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.firewall.install();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('enable')
  async enable(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.firewall.enable();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('disable')
  async disable(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.firewall.disable();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('rules')
  async addRule(
    @Body() body: {
      action: 'allow' | 'deny' | 'reject' | 'limit';
      port?: string;
      protocol?: 'tcp' | 'udp' | 'any';
      from?: string;
      to?: string;
      comment?: string;
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.action) {
      return res.status(400).json({ success: false, error: 'action is required' });
    }
    try {
      const result = await this.firewall.addRule(body);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Delete('rules/:id')
  async deleteRule(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.firewall.deleteRule(parseInt(id, 10));
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('default')
  async setDefault(
    @Body() body: { direction: 'incoming' | 'outgoing'; policy: 'allow' | 'deny' | 'reject' },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body.direction || !body.policy) {
      return res.status(400).json({ success: false, error: 'direction and policy are required' });
    }
    try {
      const result = await this.firewall.setDefault(body.direction, body.policy);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('reset')
  async reset(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.firewall.reset();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Post('preset/:name')
  async applyPreset(
    @Param('name') name: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.firewall.applyPreset(name);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  @Get('fail2ban')
  async getFail2Ban(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await this.firewall.getFail2BanStatus();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
