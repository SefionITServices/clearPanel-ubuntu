import { Module } from '@nestjs/common';
import { IpBlockerController } from './ip-blocker.controller';
import { IpBlockerService } from './ip-blocker.service';

@Module({
  controllers: [IpBlockerController],
  providers: [IpBlockerService],
})
export class IpBlockerModule {}
