import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ErrorPagesService } from './error-pages.service';
import { SaveErrorPageDto } from './dto/error-page.dto';

@Controller('error-pages')
@UseGuards(AuthGuard)
export class ErrorPagesController {
  constructor(private readonly svc: ErrorPagesService) {}

  @Get()
  async list(@Query('domain') domain: string) {
    if (!domain) return { success: false, error: 'Domain required' };
    const pages = await this.svc.list(domain);
    return { success: true, pages };
  }

  @Post()
  async save(@Body() dto: SaveErrorPageDto) {
    return this.svc.save(dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
