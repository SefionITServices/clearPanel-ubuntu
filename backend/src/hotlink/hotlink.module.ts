import { Module } from '@nestjs/common';
import { HotlinkController } from './hotlink.controller';
import { HotlinkService } from './hotlink.service';

@Module({
  controllers: [HotlinkController],
  providers: [HotlinkService],
})
export class HotlinkModule {}
