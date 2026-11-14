import { Module } from '@nestjs/common';
import { BaasController } from './baas.controller';
import { BaasService } from './baas.service';

@Module({
  controllers: [BaasController],
  providers: [BaasService],
  exports: [BaasService],
})
export class BaasModule {}
