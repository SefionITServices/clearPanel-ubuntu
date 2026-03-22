import { Module } from '@nestjs/common';
import { ProjectDetectorService } from './project-detector.service';
import { ProjectDetectorController } from './project-detector.controller';

@Module({
  providers: [ProjectDetectorService],
  controllers: [ProjectDetectorController],
  exports: [ProjectDetectorService],
})
export class ProjectDetectorModule {}
