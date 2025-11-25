import { Module } from '@nestjs/common';
import { ParserAdapterService } from './parser-adapter.service';

@Module({
  providers: [ParserAdapterService],
  exports: [ParserAdapterService],
})
export class ParserAdapterModule {}

