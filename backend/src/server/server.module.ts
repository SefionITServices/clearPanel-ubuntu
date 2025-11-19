import { Module } from '@nestjs/common';
import { ServerSettingsService } from './server-settings.service';
import { ServerController } from './server.controller';
import { DnsModule } from '../dns/dns.module';
import { DnsServerModule } from '../dns-server/dns-server.module';

@Module({
  imports: [DnsModule, DnsServerModule],
  providers: [ServerSettingsService],
  controllers: [ServerController],
  exports: [ServerSettingsService],
})
export class ServerModule {}
