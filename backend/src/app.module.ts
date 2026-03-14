import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { FallbackMiddleware } from './fallback.middleware';

import { TerminalModule } from './terminal/terminal.module';
import { DomainsModule } from './domains/domains.module';
import { DnsModule } from './dns/dns.module';
import { WebServerModule } from './webserver/webserver.module';
import { DnsServerModule } from './dns-server/dns-server.module';
import { ServerModule } from './server/server.module';
import { SetupModule } from './setup/setup.module';
import { SslModule } from './ssl/ssl.module';
import { DatabaseModule } from './database/database.module';
import { AppStoreModule } from './app-store/app-store.module';
import { PhpModule } from './php/php.module';
import { MailModule } from './mail/mail.module';
import { LogsModule } from './logs/logs.module';
import { SshKeysModule } from './ssh-keys/ssh-keys.module';
import { LicenseModule } from './license/license.module';
import { CronModule } from './cron/cron.module';
import { FirewallModule } from './firewall/firewall.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { BackupModule } from './backup/backup.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { ProcessModule } from './process/process.module';
import { GitModule } from './git/git.module';
import { FtpModule } from './ftp/ftp.module';
import { RedirectsModule } from './redirects/redirects.module';
import { IpBlockerModule } from './ip-blocker/ip-blocker.module';
import { DirPrivacyModule } from './dir-privacy/dir-privacy.module';
import { HotlinkModule } from './hotlink/hotlink.module';
import { DockerModule } from './docker/docker.module';
import { NodeAppsModule } from './node-apps/node-apps.module';
import { SubdomainsModule } from './subdomains/subdomains.module';
import { ErrorPagesModule } from './error-pages/error-pages.module';
import { MailingListsModule } from './mailing-lists/mailing-lists.module';
import { SpamFilterModule } from './spam-filter/spam-filter.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 10,
      },
    ]),
    AuthModule,
    FilesModule,
    TerminalModule,
    DomainsModule,
    DnsModule,
    WebServerModule,
    DnsServerModule,
    ServerModule,
    SetupModule,
    SslModule,
    DatabaseModule,
    AppStoreModule,
    PhpModule,
    MailModule,
    LogsModule,
    SshKeysModule,
    LicenseModule,
    CronModule,
    FirewallModule,
    MonitoringModule,
    BackupModule,
    TwoFactorModule,
    GitModule,
    ProcessModule,
    FtpModule,
    RedirectsModule,
    IpBlockerModule,
    DirPrivacyModule,
    HotlinkModule,
    DockerModule,
    NodeAppsModule,
    SubdomainsModule,
    ErrorPagesModule,
    MailingListsModule,
    SpamFilterModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply SPA fallback for all non-API routes in production
    if (process.env.NODE_ENV === 'production') {
      consumer.apply(FallbackMiddleware).forRoutes('*');
    }
  }
}
