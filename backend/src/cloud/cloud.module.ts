import { Module } from '@nestjs/common';
import { CloudController } from './cloud.controller';
import { CloudService } from './cloud.service';
import { BaasModule } from '../baas/baas.module';

@Module({
  imports: [BaasModule],
  controllers: [CloudController],
  providers: [CloudService],
  exports: [CloudService],
})
export class CloudModule {}
