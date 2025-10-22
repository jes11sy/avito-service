import { Module } from '@nestjs/common';
import { AvitoController } from './avito.controller';
import { AvitoService } from './avito.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  controllers: [AvitoController],
  providers: [AvitoService],
  exports: [AvitoService],
})
export class AvitoModule {}

