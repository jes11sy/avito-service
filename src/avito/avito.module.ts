import { Module } from '@nestjs/common';
import { AvitoController } from './avito.controller';
import { AvitoMessengerController } from './avito-messenger.controller';
import { AvitoService } from './avito.service';

@Module({
  controllers: [AvitoController, AvitoMessengerController],
  providers: [AvitoService],
  exports: [AvitoService],
})
export class AvitoModule {}

