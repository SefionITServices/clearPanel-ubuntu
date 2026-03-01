import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { IpBlockerService } from './ip-blocker.service';
import { CreateIpBlockDto } from './dto/ip-blocker.dto';

@Controller('ip-blocker')
@UseGuards(AuthGuard)
export class IpBlockerController {
  constructor(private readonly svc: IpBlockerService) {}

  @Get()
  async list(@Query('domain') domain?: string) {
    const entries = await this.svc.list(domain);
    return { success: true, entries };
  }

  @Post()
  async create(@Body() dto: CreateIpBlockDto) {
    return this.svc.create(dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
