import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

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
  private realtimeServiceUrl = process.env.REALTIME_SERVICE_URL || 'http://realtime-service.crm:5009';

  constructor(private prisma: PrismaService) {}

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

    try {
      // 📌 Получаем имя аккаунта из БД по userId
      const account = await this.prisma.avito.findFirst({
        where: { userId: String(value.user_id) }
      });
      const accountName = account?.name || 'Unknown Account';

      const messageData = {
        chatId: value.chat_id,
        accountName: accountName,  // ← добавляем имя аккаунта
        message: {
          id: value.id,
          authorId: value.author_id,
          content: value.content,
          created: value.created,
          direction: direction,
          type: value.type,
          chatType: value.chat_type,
          itemId: value.item_id,
          publishedAt: value.published_at,
          read: value.read,
          isRead: !isIncomingMessage,
          userId: value.user_id
        }
      };

      // Send to realtime-service via HTTP
      await this.broadcastViaRealtime('avito-new-message', messageData);

      const chatUpdateData = {
        chatId: value.chat_id,
        accountName: accountName,  // ← добавляем тут тоже
        hasNewMessage: isIncomingMessage,
        unreadCount: isIncomingMessage ? 1 : 0,
        message: messageData.message,
        lastMessage: {
          id: value.id,
          content: value.content,
          created: value.created,
          direction: direction,
          type: value.type
        },
        updated: value.created,
        isNewChat: false
      };

      await this.broadcastViaRealtime('avito-chat-updated', chatUpdateData);

      if (isIncomingMessage) {
        await this.broadcastViaRealtime('avito-notification', {
          type: 'new_message',
          chatId: value.chat_id,
          messageId: value.id,
          accountName: accountName,  // ← и тут
          message: messageData.message,
          timestamp: Date.now()
        });
      }

      this.logger.log('✅ Sent events to realtime-service');
    } catch (error) {
      this.logger.error('Error broadcasting message:', error);
    }
  }

  private async broadcastViaRealtime(event: string, data: any) {
    try {
      const url = `${this.realtimeServiceUrl}/api/v1/broadcast/avito-event`;
      this.logger.debug(`📤 Sending ${event} to realtime-service:`, url);
      
      await axios.post(url, {
        event,
        data,
        token: process.env.WEBHOOK_TOKEN
      }, {
        timeout: 5000
      });
      
      this.logger.debug(`✅ Event ${event} sent to realtime-service`);
    } catch (error: any) {
      this.logger.warn(`⚠️ Failed to send ${event} to realtime-service:`, error.message);
      // Don't throw - we still need to respond with 200 to Avito
    }
  }
}
