import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { ServerModule } from '../server/server.module';
import { DnsModule } from '../dns/dns.module';
import { DnsServerModule } from '../dns-server/dns-server.module';
import { WebServerModule } from '../webserver/webserver.module';

@Module({
    imports: [ServerModule, DnsModule, DnsServerModule, WebServerModule],
    controllers: [SetupController],
    providers: [SetupService],
    exports: [SetupService],
})
export class SetupModule { }
