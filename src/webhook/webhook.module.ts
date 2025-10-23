import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { socketIOProvider } from '../providers/socket-io.provider';
import { WebhookRegistrationService } from './webhook-registration.service';
import { MessengerModule } from '../messenger/messenger.module';

@Module({
  imports: [MessengerModule],
  controllers: [WebhookController],
  providers: [socketIOProvider, WebhookRegistrationService],
})
export class WebhookModule {}
