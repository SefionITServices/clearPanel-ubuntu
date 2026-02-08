import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { DirectoryStructureService } from './directory-structure.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, DirectoryStructureService],
  exports: [FilesService, DirectoryStructureService],
})
export class FilesModule { }
