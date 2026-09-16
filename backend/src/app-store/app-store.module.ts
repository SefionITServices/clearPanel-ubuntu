import { Module } from '@nestjs/common';
import { AppStoreController } from './app-store.controller';
import { AppStoreService } from './app-store.service';
import { DatabaseModule } from '../database/database.module';
import { WebServerModule } from '../webserver/webserver.module';
import { SslModule } from '../ssl/ssl.module';
import { NextcloudInstallerService } from './providers/nextcloud-installer.service';

@Module({
  imports: [DatabaseModule, WebServerModule, SslModule],
  controllers: [AppStoreController],
  providers: [
    AppStoreService,
    NextcloudInstallerService,
    {
      provide: 'APP_STORE_SETUP',
      useFactory: (appStore: AppStoreService, nextcloud: NextcloudInstallerService) => {
        // attach installer instance for dynamic use
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (appStore as any).nextcloudInstaller = nextcloud;
        return true;
      },
      inject: [AppStoreService, NextcloudInstallerService],
    },
  ],
  exports: [AppStoreService],
})
export class AppStoreModule {}
