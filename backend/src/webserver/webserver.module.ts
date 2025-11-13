import { Module } from '@nestjs/common';
import { WebServerService } from './webserver.service';
import { WebServerController } from './webserver.controller';

@Module({
  providers: [WebServerService],
  controllers: [WebServerController],
  exports: [WebServerService],
})
export class WebServerModule {}
