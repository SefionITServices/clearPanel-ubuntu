import { Module } from '@nestjs/common';
import { FtpController } from './ftp.controller';
import { FtpService } from './ftp.service';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [DomainsModule],
  controllers: [FtpController],
  providers: [FtpService],
})
export class FtpModule {}
