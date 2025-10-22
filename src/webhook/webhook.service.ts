import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

  async processAvitoWebhook(payload: any) {
    const { event, chat_id, message, user } = payload;

    // Обрабатываем разные типы событий от Avito
    if (event === 'message.new') {
      return this.handleNewMessage(chat_id, message, user);
    }

    if (event === 'chat.new') {
      return this.handleNewChat(chat_id, user);
    }

    this.logger.warn(`Unknown event type: ${event}`);
    return { success: true, message: 'Event ignored' };
  }

  private async handleNewChat(chatId: string, user: any) {
    // Создаем или обновляем чат
    const existingChat = await this.prisma.avitoChat.findUnique({
      where: { chatId },
    });

    if (existingChat) {
      return { success: true, message: 'Chat already exists' };
    }

    const chat = await this.prisma.avitoChat.create({
      data: {
        chatId,
        name: user?.name,
        phone: user?.phone,
        status: 'active',
      },
    });

    this.logger.log(`New chat created: ${chatId}`);

    return {
      success: true,
      message: 'Chat created',
      data: { chatId },
    };
  }

  private async handleNewMessage(chatId: string, message: any, user: any) {
    // Создаем или обновляем чат
    let chat = await this.prisma.avitoChat.findUnique({
      where: { chatId },
    });

    if (!chat) {
      chat = await this.prisma.avitoChat.create({
        data: {
          chatId,
          name: user?.name,
          phone: user?.phone,
          status: 'active',
        },
      });
    }

    // Определяем направление сообщения
    const direction = message.from_operator ? 'outbound' : 'inbound';

    // Сохраняем сообщение
    const savedMessage = await this.prisma.avitoMessage.create({
      data: {
        chatId,
        messageId: message.id || `MSG-${Date.now()}`,
        direction,
        content: message.text || message.content || '',
        authorId: message.author_id,
      },
    });

    // Обновляем последнее сообщение в чате
    await this.prisma.avitoChat.update({
      where: { chatId },
      data: {
        lastMessage: message.text || message.content,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Message saved for chat ${chatId}: ${savedMessage.id}`);

    return {
      success: true,
      message: 'Message saved',
      data: { chatId, messageId: savedMessage.id },
    };
  }
}



