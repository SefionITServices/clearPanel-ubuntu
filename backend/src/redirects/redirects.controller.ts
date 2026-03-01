import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RedirectsService } from './redirects.service';
import { CreateRedirectDto } from './dto/redirect.dto';

@Controller('redirects')
@UseGuards(AuthGuard)
export class RedirectsController {
  constructor(private readonly svc: RedirectsService) {}

  @Get()
  async list(@Query('domain') domain?: string) {
    const redirects = await this.svc.list(domain);
    return { success: true, redirects };
  }

  @Post()
  async create(@Body() dto: CreateRedirectDto) {
    return this.svc.create(dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
