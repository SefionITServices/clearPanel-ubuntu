import { Module } from '@nestjs/common';
import { TerminalController } from './terminal.controller';
import { TerminalService } from './terminal.service';
import { TerminalGateway } from './terminal.gateway';

@Module({
  controllers: [TerminalController],
  providers: [TerminalService, TerminalGateway],
})
export class TerminalModule {}
