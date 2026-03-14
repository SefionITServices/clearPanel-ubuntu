import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SpamFilterService } from './spam-filter.service';

@Controller('spam-filter')
@UseGuards(AuthGuard)
export class SpamFilterController {
  constructor(private readonly svc: SpamFilterService) {}

  @Get('status')
  async getStatus() {
    return this.svc.getStatus();
  }

  @Get('history')
  async getHistory(@Query('limit') limitArg: string) {
    const limit = parseInt(limitArg, 10) || 50;
    return this.svc.getHistory(limit);
  }

  @Get('settings')
  async getSettings(@Query('domain') domain: string) {
    if (!domain) throw new BadRequestException('domain query parameter required');
    return this.svc.getSettings(domain);
  }

  @Post('settings')
  async saveSettings(@Body() body: { domain: string; addHeaderScore?: number; rejectScore?: number; whitelist?: string[]; blacklist?: string[] }) {
    if (!body?.domain) throw new BadRequestException('domain is required');
    return this.svc.saveSettings(body.domain, body);
  }
}
