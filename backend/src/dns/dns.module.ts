import { Module } from '@nestjs/common';
import { DnsService } from './dns.service';
import { DnsController } from './dns.controller';

@Module({
  providers: [DnsService],
  controllers: [DnsController],
  exports: [DnsService],
})
export class DnsModule {}
