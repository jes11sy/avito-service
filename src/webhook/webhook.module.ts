import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { socketIOProvider } from '../providers/socket-io.provider';

@Module({
  controllers: [WebhookController],
  providers: [socketIOProvider],
})
export class WebhookModule {}
