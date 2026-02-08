import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { ServerModule } from '../server/server.module';

@Module({
    imports: [ServerModule],
    controllers: [SetupController],
    providers: [SetupService],
    exports: [SetupService],
})
export class SetupModule { }
