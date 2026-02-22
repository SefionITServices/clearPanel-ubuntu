import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ProcessService } from './process.service';

@Controller('processes')
@UseGuards(AuthGuard)
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  /* ─── List processes ───────────────────────────────────── */
  @Get()
  async list(
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
  ) {
    const sortBy = (['cpu', 'mem', 'pid'].includes(sort || '') ? sort : 'cpu') as 'cpu' | 'mem' | 'pid';
    return this.processService.listProcesses(sortBy, parseInt(limit || '100') || 100);
  }

  /* ─── Process details ─────────────────────────────────── */
  @Get(':pid')
  async details(@Param('pid') pid: string) {
    return this.processService.getProcessDetails(parseInt(pid));
  }

  /* ─── Kill process ─────────────────────────────────────── */
  @Delete(':pid')
  async kill(
    @Param('pid') pid: string,
    @Body('signal') signal?: string,
  ) {
    const sig = (['SIGTERM', 'SIGKILL', 'SIGHUP'].includes(signal || '') ? signal : 'SIGTERM') as any;
    return this.processService.killProcess(parseInt(pid), sig);
  }

  /* ─── List services ────────────────────────────────────── */
  @Get('services/list')
  async services() {
    return this.processService.listServices();
  }

  /* ─── Control service ──────────────────────────────────── */
  @Post('services/:name/:action')
  async controlService(
    @Param('name') name: string,
    @Param('action') action: string,
  ) {
    if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(action)) {
      return { success: false, message: 'Invalid action' };
    }
    return this.processService.controlService(name, action as any);
  }
}
