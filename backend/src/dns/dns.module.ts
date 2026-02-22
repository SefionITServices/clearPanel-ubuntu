import { Module } from '@nestjs/common';
import { DnsService } from './dns.service';
import { DnsController } from './dns.controller';
import { DnsServerModule } from '../dns-server/dns-server.module';

@Module({
  imports: [DnsServerModule],
  providers: [DnsService],
  controllers: [DnsController],
  exports: [DnsService],
})
export class DnsModule {}
