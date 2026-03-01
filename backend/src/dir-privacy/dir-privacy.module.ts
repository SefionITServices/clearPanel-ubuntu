import { Module } from '@nestjs/common';
import { DirPrivacyController } from './dir-privacy.controller';
import { DirPrivacyService } from './dir-privacy.service';

@Module({
  controllers: [DirPrivacyController],
  providers: [DirPrivacyService],
})
export class DirPrivacyModule {}
