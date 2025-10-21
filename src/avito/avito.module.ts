import { Module } from '@nestjs/common';
import { AvitoController } from './avito.controller';
import { AvitoService } from './avito.service';

@Module({
  controllers: [AvitoController],
  providers: [AvitoService],
  exports: [AvitoService],
})
export class AvitoModule {}

