import { Module } from '@nestjs/common';
import { SubdomainsService } from './subdomains.service';
import { SubdomainsController } from './subdomains.controller';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [DomainsModule],
  providers: [SubdomainsService],
  controllers: [SubdomainsController],
  exports: [SubdomainsService],
})
export class SubdomainsModule {}
