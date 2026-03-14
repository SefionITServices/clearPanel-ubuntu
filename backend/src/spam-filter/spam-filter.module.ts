import { Module } from '@nestjs/common';
import { SpamFilterController } from './spam-filter.controller';
import { SpamFilterService } from './spam-filter.service';

@Module({
  controllers: [SpamFilterController],
  providers: [SpamFilterService],
})
export class SpamFilterModule {}
