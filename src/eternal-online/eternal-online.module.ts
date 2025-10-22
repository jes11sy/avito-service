import { Module } from '@nestjs/common';
import { EternalOnlineController } from './eternal-online.controller';
import { EternalOnlineService } from './eternal-online.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  controllers: [EternalOnlineController],
  providers: [EternalOnlineService],
  exports: [EternalOnlineService],
})
export class EternalOnlineModule {}

