import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { HotlinkService } from './hotlink.service';
import { SetHotlinkDto } from './dto/hotlink.dto';

@Controller('hotlink')
@UseGuards(AuthGuard)
export class HotlinkController {
  constructor(private readonly svc: HotlinkService) {}

  @Get(':domain')
  async get(@Param('domain') domain: string) {
    const config = await this.svc.get(domain);
    return { success: true, config };
  }

  @Post()
  async set(@Body() dto: SetHotlinkDto) {
    return this.svc.set(dto);
  }

  @Delete(':domain')
  async disable(@Param('domain') domain: string) {
    return this.svc.disable(domain);
  }
}
