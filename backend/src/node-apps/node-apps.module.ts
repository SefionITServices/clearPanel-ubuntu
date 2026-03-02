import { Module } from '@nestjs/common';
import { NodeAppsController } from './node-apps.controller';
import { NodeAppsService } from './node-apps.service';

@Module({
  controllers: [NodeAppsController],
  providers: [NodeAppsService],
})
export class NodeAppsModule {}
