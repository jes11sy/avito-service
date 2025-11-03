import { Injectable, NotFoundException, Logger, OnModuleDestroy } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { PrismaService } from '../prisma/prisma.service';
import { AvitoApiService } from '../avito-api/avito-api.service';
import { AvitoMessengerService } from '../avito-api/avito-messenger.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { EncryptionService } from '../common/encryption.service';
import { SafeLogger } from '../common/safe-logger.service';

@Injectable()
export class AccountsService implements OnModuleDestroy {
  private readonly logger;
  
  // Use LRU cache instead of Map to prevent memory leaks
  private apiClients: LRUCache<number, AvitoApiService>;
  private messengerClients: LRUCache<number, AvitoMessengerService>;

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private safeLogger: SafeLogger,
  ) {
    this.logger = this.safeLogger.createContextLogger(AccountsService.name);
    
    // Initialize LRU caches with limits
    this.apiClients = new LRUCache<number, AvitoApiService>({
      max: 100, // Maximum 100 clients in memory
      ttl: 1000 * 60 * 60, // 1 hour TTL
      dispose: (client) => {
        // Cleanup when item is evicted
        this.logger.debug('API client evicted from cache');
      },
    });
    
    this.messengerClients = new LRUCache<number, AvitoMessengerService>({
      max: 100,
      ttl: 1000 * 60 * 60,
      dispose: (client) => {
        this.logger.debug('Messenger client evicted from cache');
      },
    });
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    this.logger.log('Cleaning up account clients...');
    this.apiClients.clear();
    this.messengerClients.clear();
  }

  /**
   * Получить все аккаунты
   * Optimized: Single query instead of N+1
   */
  async getAccounts() {
    // Use raw query to avoid N+1 problem
    const accountsWithCounts = await this.prisma.$queryRaw<any[]>`
      SELECT 
        a.*,
        COUNT(DISTINCT c.id)::int as calls_count,
        COUNT(DISTINCT o.id)::int as orders_count
      FROM avito a
      LEFT JOIN calls c ON c.avito_name = a.name
      LEFT JOIN orders o ON o.avito_name = a.name
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `;

    // Decrypt sensitive fields and format for frontend
    const formattedAccounts = await Promise.all(
      accountsWithCounts.map(async (account) => ({
        id: account.id,
        name: account.name,
        clientId: account.client_id,
        clientSecret: await this.encryption.decryptIfNeeded(account.client_secret),
        userId: account.user_id,
        proxyType: account.proxy_type,
        proxyHost: account.proxy_host,
        proxyPort: account.proxy_port,
        proxyLogin: account.proxy_login,
        proxyPassword: account.proxy_password 
          ? await this.encryption.decryptIfNeeded(account.proxy_password)
          : null,
        connectionStatus: account.connection_status === 'connected' ? 'online' : 'offline',
        proxyStatus: account.proxy_status === 'connected' ? 'active' : 'inactive',
        cpa: account.account_balance || 0, // CPA баланс уже в копейках, фронт сам отформатирует
        adsCount: account.ads_count || 0,
        viewsCount: account.views_count || 0,
        contactsCount: account.contacts_count || 0,
        lastSyncAt: account.last_sync_at,
        createdAt: account.created_at,
        eternalOnlineEnabled: account.eternal_online_enabled,
        onlineKeepAliveInterval: account.online_keep_alive_interval,
      }))
    );

    return {
      success: true,
      data: formattedAccounts,
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
    // Encrypt sensitive data before storing
    const encryptedClientSecret = await this.encryption.encrypt(dto.clientSecret);
    const encryptedProxyPassword = dto.proxyPassword 
      ? await this.encryption.encrypt(dto.proxyPassword)
      : null;

    const account = await this.prisma.avito.create({
      data: {
        name: dto.name,
        clientId: dto.clientId,
        clientSecret: encryptedClientSecret,
        userId: dto.userId,
        proxyType: dto.proxyType,
        proxyHost: dto.proxyHost,
        proxyPort: dto.proxyPort,
        proxyLogin: dto.proxyLogin,
        proxyPassword: encryptedProxyPassword,
        eternalOnlineEnabled: dto.eternalOnlineEnabled || false,
        onlineKeepAliveInterval: dto.onlineKeepAliveInterval || 300,
      },
    });

    // Инициализируем клиенты (now properly async)
    await this.initializeClients(account.id);

    // Проверяем подключение
    await this.checkConnection(account.id);

    this.logger.log(`Account created: ${account.name} (ID: ${account.id})`);

    // Return account with decrypted secrets for response
    return {
      success: true,
      message: 'Account created successfully',
      data: {
        ...account,
        clientSecret: dto.clientSecret, // Return original, not encrypted
        proxyPassword: dto.proxyPassword,
      },
    };
  }

  /**
   * Обновить аккаунт
   */
  async updateAccount(id: number, dto: UpdateAccountDto) {
    // Prepare encrypted data
    const updateData: any = {};
    
    if (dto.name) updateData.name = dto.name;
    if (dto.clientId) updateData.clientId = dto.clientId;
    if (dto.clientSecret) {
      updateData.clientSecret = await this.encryption.encrypt(dto.clientSecret);
    }
    if (dto.userId) updateData.userId = dto.userId;
    if (dto.proxyType !== undefined) updateData.proxyType = dto.proxyType;
    if (dto.proxyHost !== undefined) updateData.proxyHost = dto.proxyHost;
    if (dto.proxyPort !== undefined) updateData.proxyPort = dto.proxyPort;
    if (dto.proxyLogin !== undefined) updateData.proxyLogin = dto.proxyLogin;
    if (dto.proxyPassword !== undefined) {
      updateData.proxyPassword = dto.proxyPassword 
        ? await this.encryption.encrypt(dto.proxyPassword)
        : null;
    }
    if (dto.eternalOnlineEnabled !== undefined) {
      updateData.eternalOnlineEnabled = dto.eternalOnlineEnabled;
    }
    if (dto.onlineKeepAliveInterval !== undefined) {
      updateData.onlineKeepAliveInterval = dto.onlineKeepAliveInterval;
    }

    const account = await this.prisma.avito.update({
      where: { id },
      data: updateData,
    });

    // Clear cached clients and reinitialize
    this.apiClients.delete(id);
    this.messengerClients.delete(id);
    await this.initializeClients(id);

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
      const [cpaBalance, accountInfo] = await Promise.all([
        apiClient.getCPABalance(),
        apiClient.getAccountInfo(),
      ]);

      let aggregatedStats = null;
      if (account.userId) {
        aggregatedStats = await apiClient.getAggregatedStats(parseInt(account.userId));
      }

      await this.prisma.avito.update({
        where: { id: accountId },
        data: {
          accountBalance: cpaBalance.advance || 0, // CPA АВАНС в копейках (это то что показывается в интерфейсе Avito)
          adsCount: aggregatedStats?.adsCount || 0,
          viewsCount: aggregatedStats?.totalViews || 0,
          contactsCount: aggregatedStats?.totalContacts || 0,
          lastSyncAt: new Date(),
        },
      });

      this.logger.log(`Stats synced for account ${accountId}`);

      return {
        success: true,
        message: 'Stats synchronized',
        data: { cpaBalance, aggregatedStats, accountInfo },
      };
    } catch (error: any) {
      this.logger.error(`Failed to sync stats for account ${accountId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Массовая проверка всех подключений
   */
  async checkAllConnections() {
    const accounts = await this.prisma.avito.findMany();
    
    this.logger.log(`Starting connection check for ${accounts.length} accounts`);
    
    const results = await Promise.allSettled(
      accounts.map(account => this.checkConnection(account.id))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    this.logger.log(`Connection check completed: ${successCount}/${accounts.length} successful`);

    return {
      success: true,
      message: `Checked ${accounts.length} accounts`,
      data: {
        total: accounts.length,
        successful: successCount,
        failed: accounts.length - successCount,
      },
    };
  }

  /**
   * Массовая проверка всех прокси
   */
  async checkAllProxies() {
    const accounts = await this.prisma.avito.findMany({
      where: {
        proxyHost: { not: null },
      },
    });
    
    this.logger.log(`Starting proxy check for ${accounts.length} accounts`);
    
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        const apiClient = await this.getApiClient(account.id);
        const isProxyOk = await apiClient.proxyCheck();
        
        await this.prisma.avito.update({
          where: { id: account.id },
          data: {
            proxyStatus: isProxyOk ? 'connected' : 'disconnected',
          },
        });

        return { accountId: account.id, success: isProxyOk };
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    this.logger.log(`Proxy check completed: ${successCount}/${accounts.length} successful`);

    return {
      success: true,
      message: `Checked ${accounts.length} proxies`,
      data: {
        total: accounts.length,
        successful: successCount,
        failed: accounts.length - successCount,
      },
    };
  }

  /**
   * Синхронизация статистики для всех аккаунтов
   */
  async syncAllAccountsStats() {
    const accounts = await this.prisma.avito.findMany();
    
    this.logger.log(`Starting stats sync for ${accounts.length} accounts`);
    
    const results = await Promise.allSettled(
      accounts.map(account => this.syncAccountStats(account.id))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    this.logger.log(`Stats sync completed: ${successCount}/${accounts.length} successful`);

    return {
      success: true,
      message: `Synced stats for ${accounts.length} accounts`,
      data: {
        total: accounts.length,
        successful: successCount,
        failed: accounts.length - successCount,
      },
    };
  }

  /**
   * Получить API клиент для аккаунта
   */
  async getApiClient(accountId: number): Promise<AvitoApiService> {
    const cached = this.apiClients.get(accountId);
    if (cached) {
      return cached;
    }

    const { apiClient } = await this.initializeClients(accountId);
    return apiClient;
  }

  /**
   * Получить Messenger клиент для аккаунта
   */
  async getMessengerClient(accountId: number): Promise<AvitoMessengerService> {
    const cached = this.messengerClients.get(accountId);
    if (cached) {
      return cached;
    }

    const { messengerClient } = await this.initializeClients(accountId);
    return messengerClient;
  }

  /**
   * Инициализировать клиенты для аккаунта
   * FIXED: Now properly async to prevent race conditions
   */
  private async initializeClients(accountId: number) {
    const account = await this.prisma.avito.findUniqueOrThrow({ 
      where: { id: accountId } 
    });

    // Decrypt secrets before using them
    const decryptedClientSecret = await this.encryption.decryptIfNeeded(account.clientSecret);
    const decryptedProxyPassword = account.proxyPassword
      ? await this.encryption.decryptIfNeeded(account.proxyPassword)
      : null;

    const proxyConfig = account.proxyHost
      ? {
          host: account.proxyHost,
          port: account.proxyPort,
          protocol: account.proxyType as any,
          auth: account.proxyLogin
            ? {
                username: account.proxyLogin,
                password: decryptedProxyPassword,
              }
            : undefined,
        }
      : undefined;

    const apiClient = new AvitoApiService(
      account.clientId, 
      decryptedClientSecret, 
      proxyConfig
    );
    
    const messengerClient = new AvitoMessengerService(
      account.clientId,
      decryptedClientSecret,
      account.userId ? parseInt(account.userId) : 0,
      proxyConfig,
    );

    this.apiClients.set(accountId, apiClient);
    this.messengerClients.set(accountId, messengerClient);

    this.logger.log(`Clients initialized for account ${accountId}`);

    return {
      apiClient,
      messengerClient,
    };
  }
}

