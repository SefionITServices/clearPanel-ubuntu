import { Module } from '@nestjs/common';
import { DnsServerService } from './dns-server.service';
import { DnsServerController } from './dns-server.controller';

@Module({
  controllers: [DnsServerController],
  providers: [DnsServerService],
  exports: [DnsServerService],
})
export class DnsServerModule {}
