import { Controller, Post, Body, Logger, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SOCKET_IO_PROVIDER } from '../providers/socket-io.provider';

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

  constructor(
    @Inject(SOCKET_IO_PROVIDER) private socketIOWrapper: any,
  ) {
    // Initialize Socket.IO connection on module load
    this.initializeSocket();
  }

  private async initializeSocket() {
    try {
      await this.socketIOWrapper.getSocket();
      this.logger.log('✅ Socket.IO client initialized');
    } catch (error) {
      this.logger.warn('⚠️ Socket.IO initialization warning:', error?.message);
    }
  }

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

    // Broadcast to all connected operators via Socket.IO
    try {
      const messageData = {
        chatId: value.chat_id,
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
      
      // Emit new message event
      this.socketIOWrapper.emit('avito-new-message', messageData);
      
      // Emit chat update event
      const chatUpdateData = {
        chatId: value.chat_id,
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
      
      this.socketIOWrapper.emit('avito-chat-updated', chatUpdateData);
      
      // If incoming message, also emit notification
      if (isIncomingMessage) {
        this.socketIOWrapper.emit('avito-notification', {
          type: 'new_message',
          chatId: value.chat_id,
          messageId: value.id,
          message: messageData.message,
          timestamp: Date.now()
        });
      }
      
      this.logger.log('✅ Broadcasted new message event');
    } catch (error) {
      this.logger.error('Error broadcasting message:', error);
    }
  }
}
