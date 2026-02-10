import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LogsService } from './logs.service';

@Controller('logs')
@UseGuards(AuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /** GET /api/logs/sources — list available log sources */
  @Get('sources')
  async getSources() {
    return this.logsService.getSources();
  }

  /** GET /api/logs/:source?lines=100 — fetch log output */
  @Get(':source')
  async getLog(
    @Param('source') source: string,
    @Query('lines') linesStr?: string,
  ) {
    const lines = linesStr ? parseInt(linesStr, 10) : 100;
    if (isNaN(lines) || lines < 1) {
      throw new BadRequestException('lines must be a positive integer');
    }
    return this.logsService.getLog(source, lines);
  }
}
