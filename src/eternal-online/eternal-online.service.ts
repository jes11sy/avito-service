import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class EternalOnlineService {
  private readonly logger = new Logger(EternalOnlineService.name);

  constructor(
    private prisma: PrismaService,
    private accountsService: AccountsService,
  ) {}

  /**
   * Cron задача для поддержания онлайн статуса
   * Запускается каждые 5 минут
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async maintainOnlineStatus() {
    this.logger.log('Running eternal online check...');

    const accounts = await this.prisma.avito.findMany({
      where: {
        eternalOnlineEnabled: true,
      },
    });

    if (accounts.length === 0) {
      this.logger.log('No accounts with eternal online enabled');
      return;
    }

    this.logger.log(`Checking ${accounts.length} accounts for online status`);

    const promises = accounts.map((account) => this.setAccountOnline(account.id));
    const results = await Promise.allSettled(promises);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Eternal online check completed: ${successful} successful, ${failed} failed`);
  }

  /**
   * Установить аккаунт в онлайн
   */
  async setAccountOnline(accountId: number) {
    try {
      const account = await this.prisma.avito.findUnique({
        where: { id: accountId },
      });

      if (!account || !account.eternalOnlineEnabled) {
        return;
      }

      // Проверяем, нужно ли обновлять статус
      const now = new Date();
      const lastCheck = account.lastOnlineCheck;
      const interval = account.onlineKeepAliveInterval || 300;

      if (lastCheck && now.getTime() - lastCheck.getTime() < interval * 1000) {
        // Слишком рано для обновления
        return;
      }

      // Получаем messenger клиент и устанавливаем онлайн
      const messengerClient = await this.accountsService.getMessengerClient(accountId);
      await messengerClient.setOnline();

      // Обновляем статус в БД
      await this.prisma.avito.update({
        where: { id: accountId },
        data: {
          isOnline: true,
          lastOnlineCheck: now,
        },
      });

      this.logger.log(`Account ${account.name} (ID: ${accountId}) set to online`);
    } catch (error: any) {
      this.logger.error(`Failed to set account ${accountId} online: ${error.message}`);

      // Обновляем статус как offline в случае ошибки
      await this.prisma.avito.update({
        where: { id: accountId },
        data: {
          isOnline: false,
        },
      });
    }
  }

  /**
   * Включить "вечный онлайн" для аккаунта
   */
  async enableEternalOnline(accountId: number, interval: number = 300) {
    await this.prisma.avito.update({
      where: { id: accountId },
      data: {
        eternalOnlineEnabled: true,
        onlineKeepAliveInterval: interval,
      },
    });

    // Сразу устанавливаем онлайн
    await this.setAccountOnline(accountId);

    this.logger.log(`Eternal online enabled for account ${accountId}`);

    return {
      success: true,
      message: 'Eternal online enabled',
    };
  }

  /**
   * Отключить "вечный онлайн" для аккаунта
   */
  async disableEternalOnline(accountId: number) {
    await this.prisma.avito.update({
      where: { id: accountId },
      data: {
        eternalOnlineEnabled: false,
        isOnline: false,
      },
    });

    this.logger.log(`Eternal online disabled for account ${accountId}`);

    return {
      success: true,
      message: 'Eternal online disabled',
    };
  }
}

