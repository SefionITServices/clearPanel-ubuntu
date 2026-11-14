import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BaasService } from './baas.service';
import { CreateBaasDto, BaasInstance, BaasSdkSnippet, BaasOverviewStats } from './baas.types';

@Controller('baas')
@UseGuards(AuthGuard)
export class BaasController {
  constructor(private readonly baasService: BaasService) {}

  @Get('stats')
  async getStats(): Promise<BaasOverviewStats> {
    return this.baasService.getOverviewStats();
  }

  @Post('install')
  async installBinary(): Promise<{ installed: boolean; path?: string; version?: string; error?: string }> {
    return this.baasService.ensureBinaryInstalled();
  }

  @Get('instances')
  async listInstances(): Promise<{ success: boolean; instances: BaasInstance[] }> {
    const instances = await this.baasService.listInstances();
    return { success: true, instances };
  }

  @Post('instances')
  async createInstance(@Body() dto: CreateBaasDto): Promise<{ success: boolean; instance: BaasInstance }> {
    const instance = await this.baasService.createInstance(dto);
    return { success: true, instance };
  }

  @Get('instances/:id')
  async getInstance(@Param('id') id: string): Promise<{ success: boolean; instance: BaasInstance }> {
    const instance = await this.baasService.getInstance(id);
    return { success: true, instance };
  }

  @Post('instances/:id/start')
  async startInstance(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.baasService.startInstance(id);
  }

  @Post('instances/:id/stop')
  async stopInstance(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.baasService.stopInstance(id);
  }

  @Post('instances/:id/restart')
  async restartInstance(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.baasService.restartInstance(id);
  }

  @Delete('instances/:id')
  async deleteInstance(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.baasService.deleteInstance(id);
  }

  @Get('instances/:id/logs')
  async getLogs(
    @Param('id') id: string,
    @Query('lines') lines?: string,
  ): Promise<{ success: boolean; logs: string }> {
    const n = lines ? parseInt(lines, 10) : 50;
    const logs = await this.baasService.getLogs(id, n);
    return { success: true, logs };
  }

  @Get('instances/:id/snippets')
  async getSnippets(@Param('id') id: string): Promise<{ success: boolean; snippets: BaasSdkSnippet[] }> {
    const instance = await this.baasService.getInstance(id);
    const snippets = this.baasService.getSdkSnippets(id, instance);
    return { success: true, snippets };
  }
}
