import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { DirectoryStructureService } from './directory-structure.service';
import { FileShareService } from './file-share.service';
import { FilesPublicController } from './public.controller';

@Module({
  controllers: [FilesController, FilesPublicController],
  providers: [FilesService, DirectoryStructureService, FileShareService],
  exports: [FilesService, DirectoryStructureService, FileShareService],
})
export class FilesModule { }
