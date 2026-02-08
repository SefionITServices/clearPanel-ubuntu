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
