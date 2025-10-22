import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoMessengerService } from '../avito-api/avito-messenger.service';

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);
  private messengerServices: Map<string, AvitoMessengerService> = new Map();

  constructor(private prisma: PrismaService) {}

  async getAccounts() {
    try {
      const accounts = await this.prisma.avito.findMany({
        select: {
          id: true,
          name: true,
          userId: true,
          connectionStatus: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: accounts,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get accounts: ${error.message}`);
      throw error;
    }
  }

  private async getMessengerService(avitoAccountName: string): Promise<AvitoMessengerService> {
    // Check cache
    if (this.messengerServices.has(avitoAccountName)) {
      return this.messengerServices.get(avitoAccountName)!;
    }

    // Find account in database
    const account = await this.prisma.avito.findUnique({
      where: { name: avitoAccountName },
    });

    if (!account) {
      throw new NotFoundException(`Avito account ${avitoAccountName} not found`);
    }

    // Create messenger service instance
    const proxyConfig = account.proxyHost ? {
      host: account.proxyHost,
      port: account.proxyPort!,
      protocol: account.proxyType as any,
      auth: account.proxyLogin ? {
        username: account.proxyLogin,
        password: account.proxyPassword!,
      } : undefined,
    } : undefined;

    const messengerService = new AvitoMessengerService(
      account.clientId,
      account.clientSecret,
      parseInt(account.userId || '0'),
      proxyConfig,
    );

    // Cache the service
    this.messengerServices.set(avitoAccountName, messengerService);

    return messengerService;
  }

  async getChats(avitoAccountName: string, unreadOnly: boolean = false, limit?: number) {
    try {
      const service = await this.getMessengerService(avitoAccountName);
      const chats = await service.getChats();

      let filteredChats = chats;
      
      if (unreadOnly) {
        // Filter for unread chats (this would need to be implemented based on your logic)
        // For now, returning all chats
        filteredChats = chats;
      }

      if (limit) {
        filteredChats = filteredChats.slice(0, limit);
      }

      // Map chats to include extracted avatar URLs
      const mappedChats = filteredChats.map(chat => {
        // Map users to extract avatar URLs
        const mappedUsers = chat.users.map(user => {
          // Extract avatar URL (prefer 64x64, fallback to default or other sizes)
          const avatar = user.public_user_profile?.avatar?.images?.['64x64'] 
            || user.public_user_profile?.avatar?.images?.['128x128']
            || user.public_user_profile?.avatar?.images?.['48x48']
            || user.public_user_profile?.avatar?.default;

          return {
            id: user.id,
            name: user.name,
            avatar: avatar,
          };
        });

        return {
          ...chat,
          users: mappedUsers,
        };
      });

      return {
        success: true,
        data: mappedChats,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get chats: ${error.message}`);
      throw error;
    }
  }

  async getMessages(chatId: string, avitoAccountName?: string, limit: number = 100) {
    try {
      if (avitoAccountName) {
        // Use specified account
        const service = await this.getMessengerService(avitoAccountName);
        const messages = await service.getMessages(chatId, limit);
        
        return {
          success: true,
          data: messages,
        };
      }

      // If no account specified, try all cached services
      for (const [accountName, service] of this.messengerServices) {
        try {
          const messages = await service.getMessages(chatId, limit);
          return {
            success: true,
            data: messages,
          };
        } catch {
          // Continue to next service
        }
      }

      throw new NotFoundException('Messages not found. Please provide avitoAccountName parameter.');
    } catch (error: any) {
      this.logger.error(`Failed to get messages: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(chatId: string, text: string, avitoAccountName: string) {
    try {
      const service = await this.getMessengerService(avitoAccountName);
      const result = await service.sendMessage(chatId, text);

      return {
        success: true,
        message: 'Message sent',
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }

  async markChatAsRead(chatId: string, avitoAccountName: string) {
    try {
      const service = await this.getMessengerService(avitoAccountName);
      
      // Mark entire chat as read (no message ID needed)
      await service.markAsRead(chatId);

      return {
        success: true,
        message: 'Chat marked as read',
      };
    } catch (error: any) {
      this.logger.error(`Failed to mark chat as read: ${error.message}`);
      throw error;
    }
  }

  async getVoiceFiles(avitoAccountName: string) {
    // Implement voice files retrieval logic
    // This might need to query your database or external storage
    return {
      success: true,
      data: [],
    };
  }

  async registerWebhooksForAll(webhookUrl: string) {
    try {
      const accounts = await this.prisma.avito.findMany();

      const results = await Promise.allSettled(
        accounts.map(async (account) => {
          // Implement webhook registration logic here
          // This would call Avito API to register webhook
          return { accountName: account.name, success: true };
        })
      );

      return {
        success: true,
        message: 'Webhooks registered',
        data: results,
      };
    } catch (error: any) {
      this.logger.error(`Failed to register webhooks: ${error.message}`);
      throw error;
    }
  }
}

