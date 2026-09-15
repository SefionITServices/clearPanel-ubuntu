import { Module } from '@nestjs/common';
import { NodeAppsController } from './node-apps.controller';
import { NodeAppsService } from './node-apps.service';
import { WebServerModule } from '../webserver/webserver.module';

@Module({
  imports: [WebServerModule],
  controllers: [NodeAppsController],
  providers: [NodeAppsService],
})
export class NodeAppsModule {}
