import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { TerminalService } from './terminal.service';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

// Use plain 'terminal' because global prefix 'api' is set in main.ts
@Controller('terminal')
@UseGuards(AuthGuard)
export class TerminalController {
  constructor(private readonly terminalService: TerminalService) {}

  private getSessionId(req: Request) {
    return (req.sessionID || 'default');
  }

  @Post('exec')
  async exec(@Body('command') command: string, @Req() req: Request) {
    return this.terminalService.execCommand(command, this.getSessionId(req));
  }

  @Get('info')
  async info(@Req() req: Request) {
    return this.terminalService.getSessionInfo(this.getSessionId(req));
  }
}
