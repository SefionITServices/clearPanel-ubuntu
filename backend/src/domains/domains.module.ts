import { Module } from '@nestjs/common';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { DnsModule } from '../dns/dns.module';
import { WebServerModule } from '../webserver/webserver.module';
import { DnsServerModule } from '../dns-server/dns-server.module';
import { ServerModule } from '../server/server.module';
import { MailModule } from '../mail/mail.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [DnsModule, WebServerModule, DnsServerModule, ServerModule, MailModule, FilesModule],
  providers: [DomainsService],
  controllers: [DomainsController],
})
export class DomainsModule { }
