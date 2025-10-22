import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoApiService } from '../avito-api/avito-api.service';
import { AvitoMessengerService } from '../avito-api/avito-messenger.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private apiClients: Map<number, AvitoApiService> = new Map();
  private messengerClients: Map<number, AvitoMessengerService> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Получить все аккаунты
   */
  async getAccounts() {
    const accounts = await this.prisma.avito.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { calls: true, orders: true },
        },
      },
    });

    return {
      success: true,
      data: accounts,
    };
  }

  /**
   * Получить аккаунт по ID
   */
  async getAccount(id: number) {
    const account = await this.prisma.avito.findUnique({
      where: { id },
      include: {
        calls: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          take: 10,
          orderBy: { createDate: 'desc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return {
      success: true,
      data: account,
    };
  }

  /**
   * Создать аккаунт
   */
  async createAccount(dto: CreateAccountDto) {
    const account = await this.prisma.avito.create({
      data: {
        name: dto.name,
        clientId: dto.clientId,
        clientSecret: dto.clientSecret,
        userId: dto.userId,
        proxyType: dto.proxyType,
        proxyHost: dto.proxyHost,
        proxyPort: dto.proxyPort,
        proxyLogin: dto.proxyLogin,
        proxyPassword: dto.proxyPassword,
        eternalOnlineEnabled: dto.eternalOnlineEnabled || false,
        onlineKeepAliveInterval: dto.onlineKeepAliveInterval || 300,
      },
    });

    // Инициализируем клиенты
    this.initializeClients(account.id);

    // Проверяем подключение
    await this.checkConnection(account.id);

    this.logger.log(`Account created: ${account.name} (ID: ${account.id})`);

    return {
      success: true,
      message: 'Account created successfully',
      data: account,
    };
  }

  /**
   * Обновить аккаунт
   */
  async updateAccount(id: number, dto: UpdateAccountDto) {
    const account = await this.prisma.avito.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.clientId && { clientId: dto.clientId }),
        ...(dto.clientSecret && { clientSecret: dto.clientSecret }),
        ...(dto.userId && { userId: dto.userId }),
        ...(dto.proxyType !== undefined && { proxyType: dto.proxyType }),
        ...(dto.proxyHost !== undefined && { proxyHost: dto.proxyHost }),
        ...(dto.proxyPort !== undefined && { proxyPort: dto.proxyPort }),
        ...(dto.proxyLogin !== undefined && { proxyLogin: dto.proxyLogin }),
        ...(dto.proxyPassword !== undefined && { proxyPassword: dto.proxyPassword }),
        ...(dto.eternalOnlineEnabled !== undefined && { eternalOnlineEnabled: dto.eternalOnlineEnabled }),
        ...(dto.onlineKeepAliveInterval !== undefined && { onlineKeepAliveInterval: dto.onlineKeepAliveInterval }),
      },
    });

    // Переинициализируем клиенты с новыми данными
    this.initializeClients(id);

    this.logger.log(`Account updated: ${account.name} (ID: ${id})`);

    return {
      success: true,
      message: 'Account updated successfully',
      data: account,
    };
  }

  /**
   * Удалить аккаунт
   */
  async deleteAccount(id: number) {
    await this.prisma.avito.delete({
      where: { id },
    });

    // Удаляем клиенты из памяти
    this.apiClients.delete(id);
    this.messengerClients.delete(id);

    this.logger.log(`Account deleted: ID ${id}`);

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  /**
   * Проверить подключение к API
   */
  async checkConnection(accountId: number) {
    const apiClient = await this.getApiClient(accountId);
    const account = await this.prisma.avito.findUnique({ where: { id: accountId } });

    let connectionStatus = 'disconnected';
    let proxyStatus = 'not_checked';

    try {
      const isHealthy = await apiClient.healthCheck();
      connectionStatus = isHealthy ? 'connected' : 'disconnected';

      if (account.proxyHost) {
        const isProxyOk = await apiClient.proxyCheck();
        proxyStatus = isProxyOk ? 'connected' : 'disconnected';
      }
    } catch (error: any) {
      this.logger.error(`Connection check failed for account ${accountId}: ${error.message}`);
      connectionStatus = 'error';
    }

    await this.prisma.avito.update({
      where: { id: accountId },
      data: {
        connectionStatus,
        proxyStatus,
      },
    });

    return {
      success: true,
      data: {
        connectionStatus,
        proxyStatus,
      },
    };
  }

  /**
   * Синхронизировать статистику аккаунта
   */
  async syncAccountStats(accountId: number) {
    const apiClient = await this.getApiClient(accountId);
    const account = await this.prisma.avito.findUnique({ where: { id: accountId } });

    try {
      const [balance, accountInfo] = await Promise.all([
        apiClient.getBalance(),
        apiClient.getAccountInfo(),
      ]);

      let itemsStats = null;
      if (account.userId) {
        itemsStats = await apiClient.getItemsStats(parseInt(account.userId));
      }

      await this.prisma.avito.update({
        where: { id: accountId },
        data: {
          accountBalance: balance.real + balance.bonus,
          adsCount: itemsStats?.count || 0,
          lastSyncAt: new Date(),
        },
      });

      this.logger.log(`Stats synced for account ${accountId}`);

      return {
        success: true,
        message: 'Stats synchronized',
        data: { balance, itemsStats, accountInfo },
      };
    } catch (error: any) {
      this.logger.error(`Failed to sync stats for account ${accountId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить API клиент для аккаунта
   */
  async getApiClient(accountId: number): Promise<AvitoApiService> {
    if (this.apiClients.has(accountId)) {
      return this.apiClients.get(accountId);
    }

    return this.initializeClients(accountId).apiClient;
  }

  /**
   * Получить Messenger клиент для аккаунта
   */
  async getMessengerClient(accountId: number): Promise<AvitoMessengerService> {
    if (this.messengerClients.has(accountId)) {
      return this.messengerClients.get(accountId);
    }

    return this.initializeClients(accountId).messengerClient;
  }

  /**
   * Инициализировать клиенты для аккаунта
   */
  private initializeClients(accountId: number) {
    const account = this.prisma.avito.findUniqueOrThrow({ where: { id: accountId } });

    account.then((acc) => {
      const proxyConfig = acc.proxyHost
        ? {
            host: acc.proxyHost,
            port: acc.proxyPort,
            protocol: acc.proxyType as any,
            auth: acc.proxyLogin
              ? {
                  username: acc.proxyLogin,
                  password: acc.proxyPassword,
                }
              : undefined,
          }
        : undefined;

      const apiClient = new AvitoApiService(acc.clientId, acc.clientSecret, proxyConfig);
      const messengerClient = new AvitoMessengerService(
        acc.clientId,
        acc.clientSecret,
        acc.userId ? parseInt(acc.userId) : 0,
        proxyConfig,
      );

      this.apiClients.set(accountId, apiClient);
      this.messengerClients.set(accountId, messengerClient);

      this.logger.log(`Clients initialized for account ${accountId}`);
    });

    return {
      apiClient: this.apiClients.get(accountId),
      messengerClient: this.messengerClients.get(accountId),
    };
  }
}

