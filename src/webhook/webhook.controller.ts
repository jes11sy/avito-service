import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

interface AvitoWebhookEvent {
  id: string;
  timestamp: number;
  version: string;
  payload: {
    type: 'message';
    value: {
      author_id: number;
      chat_id: string;
      chat_type: 'u2i' | 'u2u';
      content: any;
      created: number;
      id: string;
      item_id?: number;
      published_at: string;
      read?: number;
      type: string;
      user_id: number;
    };
  };
}

@ApiTags('webhooks')
@Controller('webhooks/avito')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle incoming Avito Messenger webhook' })
  async handleWebhook(@Body() event: AvitoWebhookEvent) {
    try {
      this.logger.debug('📨 Received Avito webhook:', {
        id: event.id,
        type: event.payload.type,
        chatId: event.payload.value.chat_id,
        messageId: event.payload.value.id,
      });

      // Immediately respond with 200 OK (requirement from Avito)
      // Process asynchronously
      setImmediate(() => {
        this.processWebhookEvent(event);
      });

      return { ok: true };
    } catch (error) {
      this.logger.error('❌ Error handling Avito webhook:', error);
      // Still return 200 to prevent Avito from retrying
      return { ok: true };
    }
  }

  private async processWebhookEvent(event: AvitoWebhookEvent) {
    try {
      if (event.payload.type === 'message') {
        await this.handleNewMessage(event);
      }
    } catch (error) {
      this.logger.error('Error processing webhook event:', error);
    }
  }

  private async handleNewMessage(event: AvitoWebhookEvent) {
    const { value } = event.payload;

    if (!value) {
      this.logger.warn('Message event without message data');
      return;
    }

    const direction = value.author_id === value.user_id ? 'out' : 'in';
    const isIncomingMessage = direction === 'in';

    this.logger.debug('💬 New message in chat:', {
      chatId: value.chat_id,
      messageId: value.id,
      direction,
      isIncoming: isIncomingMessage,
    });

    // Here we would emit Socket.IO events if we had access to Socket.IO
    // For now, this just logs the message
    // The actual Socket.IO broadcasting should be handled by the messenger service
    
    this.logger.info('✅ Processed new message:', {
      chatId: value.chat_id,
      messageId: value.id,
      direction,
    });
  }
}
