import { Module } from '@nestjs/common';
import { TerminalController } from './terminal.controller';
import { TerminalService } from './terminal.service';

@Module({
  controllers: [TerminalController],
  providers: [TerminalService],
})
export class TerminalModule {}
