import { Module } from '@nestjs/common';
import { ErrorPagesController } from './error-pages.controller';
import { ErrorPagesService } from './error-pages.service';

@Module({
  controllers: [ErrorPagesController],
  providers: [ErrorPagesService],
})
export class ErrorPagesModule {}
