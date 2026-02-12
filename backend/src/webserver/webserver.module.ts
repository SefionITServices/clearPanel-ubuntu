import { Module } from '@nestjs/common';
import { WebServerService } from './webserver.service';
import { WebServerController } from './webserver.controller';
import { PhpModule } from '../php/php.module';

@Module({
  imports: [PhpModule],
  providers: [WebServerService],
  controllers: [WebServerController],
  exports: [WebServerService],
})
export class WebServerModule {}
