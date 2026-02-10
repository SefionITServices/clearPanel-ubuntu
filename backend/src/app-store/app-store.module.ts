import { Module } from '@nestjs/common';
import { AppStoreController } from './app-store.controller';
import { AppStoreService } from './app-store.service';

@Module({
  controllers: [AppStoreController],
  providers: [AppStoreService],
  exports: [AppStoreService],
})
export class AppStoreModule {}
