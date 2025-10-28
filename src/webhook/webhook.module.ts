import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookAliasController } from './webhook.alias.controller';
import { WebhookRegistrationService } from './webhook-registration.service';
import { MessengerModule } from '../messenger/messenger.module';

@Module({
  imports: [MessengerModule],
  controllers: [WebhookController, WebhookAliasController],
  providers: [WebhookRegistrationService],
})
export class WebhookModule {}
