import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DirPrivacyService } from './dir-privacy.service';
import { AddDirUserDto, CreateDirPrivacyDto } from './dto/dir-privacy.dto';

@Controller('dir-privacy')
@UseGuards(AuthGuard)
export class DirPrivacyController {
  constructor(private readonly svc: DirPrivacyService) {}

  @Get()
  async list(@Query('domain') domain?: string) {
    const entries = await this.svc.list(domain);
    return { success: true, entries };
  }

  @Post()
  async create(@Body() dto: CreateDirPrivacyDto) {
    return this.svc.create(dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/users')
  async addUser(@Param('id') id: string, @Body() dto: AddDirUserDto) {
    return this.svc.addUser(id, dto);
  }

  @Delete(':id/users/:username')
  async removeUser(@Param('id') id: string, @Param('username') username: string) {
    return this.svc.removeUser(id, username);
  }
}
