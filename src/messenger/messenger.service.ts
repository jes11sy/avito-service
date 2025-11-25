import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoMessengerService } from '../avito-api/avito-messenger.service';
import { EncryptionService } from '../common/encryption.service';
import { SafeLogger } from '../common/safe-logger.service';
import { ParserAdapterService } from '../parser-adapter/parser-adapter.service';

@Injectable()
export class MessengerService {
  private readonly logger;
  private messengerServices: LRUCache<string, AvitoMessengerService>;

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private safeLogger: SafeLogger,
    private parserAdapter: ParserAdapterService,
  ) {
    this.logger = this.safeLogger.createContextLogger(MessengerService.name);
    
    // Use LRU cache instead of Map
    this.messengerServices = new LRUCache<string, AvitoMessengerService>({
      max: 50,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

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
    const cached = this.messengerServices.get(avitoAccountName);
    if (cached) {
      return cached;
    }

    // Find account in database
    const account = await this.prisma.avito.findUnique({
      where: { name: avitoAccountName },
    });

    if (!account) {
      throw new NotFoundException(`Avito account ${avitoAccountName} not found`);
    }

    // Decrypt sensitive data
    const decryptedClientSecret = await this.encryption.decryptIfNeeded(account.clientSecret);
    const decryptedProxyPassword = account.proxyPassword
      ? await this.encryption.decryptIfNeeded(account.proxyPassword)
      : null;

    // Create messenger service instance
    const proxyConfig = account.proxyHost ? {
      host: account.proxyHost,
      port: account.proxyPort!,
      protocol: account.proxyType as any,
      auth: account.proxyLogin ? {
        username: account.proxyLogin,
        password: decryptedProxyPassword!,
      } : undefined,
    } : undefined;

    this.logger.debug(`Creating AvitoMessengerService for account: ${account.name}`);

    const messengerService = new AvitoMessengerService(
      account.clientId,
      decryptedClientSecret,
      parseInt(account.userId || '0'),
      proxyConfig,
    );

    // Cache the service
    this.messengerServices.set(avitoAccountName, messengerService);

    return messengerService;
  }

  async getChats(avitoAccountName: string, unreadOnly: boolean = false, limit?: number) {
    try {
      // Проверяем использует ли аккаунт парсер
      const account = await this.prisma.avito.findUnique({
        where: { name: avitoAccountName },
      });

      if (!account) {
        throw new NotFoundException(`Avito account ${avitoAccountName} not found`);
      }

      // Если используется парсер - используем его
      if (account.useParser) {
        return await this.getChatsViaParser(account);
      }

      // Иначе используем API
      const service = await this.getMessengerService(avitoAccountName);
      // Pass unreadOnly and limit directly to Avito API
      const chats = await service.getChats(unreadOnly, limit);

      const filteredChats = chats;

      // Map chats to include extracted avatar URLs and format last_message
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

        // Map last_message to frontend format
        const lastMessage = chat.last_message ? {
          id: chat.last_message.id,
          authorId: chat.last_message.author_id,
          text: chat.last_message.content?.text || '',
          created: chat.last_message.created,
          direction: chat.last_message.direction,
          type: chat.last_message.type,
          isRead: chat.last_message.is_read !== false, // true если прочитано или undefined
        } : undefined;

        // Determine if chat has unread messages based on last_message
        const hasUnread = chat.last_message 
          && chat.last_message.direction === 'in' 
          && chat.last_message.is_read === false;

        // Extract city from location (same as old backend)
        const city = chat.context?.value?.location?.title 
          || chat.context?.value?.location?.city_name 
          || chat.context?.value?.location?.region_name 
          || 'Не указан';

        return {
          ...chat,
          users: mappedUsers,
          lastMessage: lastMessage,
          unreadCount: hasUnread ? 1 : undefined,
          hasNewMessage: hasUnread,
          city: city,
          avitoAccountName: avitoAccountName,
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
        // Проверяем использует ли аккаунт парсер
        const account = await this.prisma.avito.findUnique({
          where: { name: avitoAccountName },
        });

        if (!account) {
          throw new NotFoundException(`Avito account ${avitoAccountName} not found`);
        }

        // Если используется парсер
        if (account.useParser) {
          return await this.getMessagesViaParser(account, chatId);
        }

        // Use specified account via API
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
      // Проверяем использует ли аккаунт парсер
      const account = await this.prisma.avito.findUnique({
        where: { name: avitoAccountName },
      });

      if (!account) {
        throw new NotFoundException(`Avito account ${avitoAccountName} not found`);
      }

      // Если используется парсер
      if (account.useParser) {
        return await this.sendMessageViaParser(account, chatId, text);
      }

      // Используем API
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
      this.logger.log(`Marking chat ${chatId} as read for account ${avitoAccountName}`);
      const service = await this.getMessengerService(avitoAccountName);
      
      // Mark entire chat as read (no message ID needed)
      await service.markAsRead(chatId);

      this.logger.log(`✅ Chat ${chatId} successfully marked as read`);
      return {
        success: true,
        message: 'Chat marked as read',
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to mark chat as read: ${error.message}`, error.stack);
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

      if (accounts.length === 0) {
        this.logger.warn('No Avito accounts found for webhook registration');
        return {
          success: true,
          message: 'No accounts to register',
          data: [],
        };
      }

      this.logger.log(`🔗 Registering webhook for ${accounts.length} accounts. URL: ${webhookUrl}`);

      const results = await Promise.allSettled(
        accounts.map(async (account) => {
          try {
            this.logger.log(`📡 Registering webhook for account: ${account.name}`);
            
            // Get the messenger service for this account
            const messengerService = await this.getMessengerService(account.name);
            
            // Register webhook via Avito API
            const success = await messengerService.registerWebhook(webhookUrl);
            
            if (success) {
              this.logger.log(`✅ Webhook registered successfully for ${account.name}`);
            } else {
              this.logger.warn(`⚠️ Webhook registration may have failed for ${account.name}`);
            }
            
            return { 
              accountName: account.name, 
              success,
              timestamp: new Date().toISOString()
            };
          } catch (error: any) {
            this.logger.error(`❌ Failed to register webhook for ${account.name}:`, error.message);
            return {
              accountName: account.name,
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            };
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

      this.logger.log(`🎯 Webhook registration completed. Success: ${successful}, Failed: ${failed}`);

      return {
        success: successful > 0,
        message: `Webhook registration completed: ${successful} success, ${failed} failed`,
        data: results.map(r => r.status === 'fulfilled' ? r.value : { error: (r as any).reason }),
      };
    } catch (error: any) {
      this.logger.error(`Failed to register webhooks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить чаты через парсер
   */
  private async getChatsViaParser(account: any) {
    try {
      this.logger.log(`Getting chats via parser for account: ${account.name}`);

      // Расшифровываем пароль
      const decryptedPassword = account.avitoPassword
        ? await this.encryption.decryptIfNeeded(account.avitoPassword)
        : null;

      const decryptedProxyPassword = account.proxyPassword
        ? await this.encryption.decryptIfNeeded(account.proxyPassword)
        : null;

      // Формируем данные для парсера
      const parserAccount = {
        id: account.id,
        login: account.avitoLogin,
        password: decryptedPassword,
        cookies: account.cookies,
        proxyHost: account.proxyHost,
        proxyPort: account.proxyPort,
        proxyType: account.proxyType,
        proxyLogin: account.proxyLogin,
        proxyPassword: decryptedProxyPassword,
      };

      // Получаем чаты через парсер
      const chats = await this.parserAdapter.getChats(parserAccount);

      // Обновляем cookies если они изменились
      if (chats.cookies && chats.cookies !== account.cookies) {
        await this.prisma.avito.update({
          where: { id: account.id },
          data: {
            cookies: chats.cookies,
            lastBrowserSession: new Date(),
          },
        });
      }

      // Преобразуем формат парсера в формат API
      const mappedChats = chats.data.map(chat => ({
        id: chat.id,
        users: [{
          id: chat.userId,
          name: chat.userName,
          avatar: null,
        }],
        last_message: {
          id: `${chat.id}_last`,
          author_id: chat.userId,
          content: { text: chat.lastMessage },
          created: chat.lastMessageTime,
        },
        context: {
          value: {
            item_id: chat.itemId,
            item_title: chat.itemTitle,
          },
        },
        unread_count: chat.unreadCount,
      }));

      return {
        success: true,
        data: mappedChats,
        source: 'parser',
      };
    } catch (error: any) {
      this.logger.error(`Failed to get chats via parser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить сообщения через парсер
   */
  private async getMessagesViaParser(account: any, chatId: string) {
    try {
      this.logger.log(`Getting messages via parser for chat: ${chatId}`);

      const decryptedPassword = account.avitoPassword
        ? await this.encryption.decryptIfNeeded(account.avitoPassword)
        : null;

      const decryptedProxyPassword = account.proxyPassword
        ? await this.encryption.decryptIfNeeded(account.proxyPassword)
        : null;

      const parserAccount = {
        id: account.id,
        login: account.avitoLogin,
        password: decryptedPassword,
        cookies: account.cookies,
        proxyHost: account.proxyHost,
        proxyPort: account.proxyPort,
        proxyType: account.proxyType,
        proxyLogin: account.proxyLogin,
        proxyPassword: decryptedProxyPassword,
      };

      const messages = await this.parserAdapter.getMessages(parserAccount, chatId);

      // Обновляем cookies
      if (messages.cookies && messages.cookies !== account.cookies) {
        await this.prisma.avito.update({
          where: { id: account.id },
          data: {
            cookies: messages.cookies,
            lastBrowserSession: new Date(),
          },
        });
      }

      // Преобразуем формат
      const mappedMessages = messages.data.map(msg => ({
        id: msg.id,
        author_id: msg.author_id,
        content: { text: msg.content },
        type: msg.type,
        direction: msg.direction,
        created: msg.created,
      }));

      return {
        success: true,
        data: mappedMessages,
        source: 'parser',
      };
    } catch (error: any) {
      this.logger.error(`Failed to get messages via parser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Отправить сообщение через парсер
   */
  private async sendMessageViaParser(account: any, chatId: string, message: string) {
    try {
      this.logger.log(`Sending message via parser to chat: ${chatId}`);

      const decryptedPassword = account.avitoPassword
        ? await this.encryption.decryptIfNeeded(account.avitoPassword)
        : null;

      const decryptedProxyPassword = account.proxyPassword
        ? await this.encryption.decryptIfNeeded(account.proxyPassword)
        : null;

      const parserAccount = {
        id: account.id,
        login: account.avitoLogin,
        password: decryptedPassword,
        cookies: account.cookies,
        proxyHost: account.proxyHost,
        proxyPort: account.proxyPort,
        proxyType: account.proxyType,
        proxyLogin: account.proxyLogin,
        proxyPassword: decryptedProxyPassword,
      };

      const result = await this.parserAdapter.sendMessage(parserAccount, chatId, message);

      // Обновляем cookies
      if (result.cookies && result.cookies !== account.cookies) {
        await this.prisma.avito.update({
          where: { id: account.id },
          data: {
            cookies: result.cookies,
            lastBrowserSession: new Date(),
          },
        });
      }

      return {
        success: true,
        message: 'Message sent via parser',
        source: 'parser',
      };
    } catch (error: any) {
      this.logger.error(`Failed to send message via parser: ${error.message}`);
      throw error;
    }
  }
}

