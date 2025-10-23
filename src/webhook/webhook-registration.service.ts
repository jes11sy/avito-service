import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MessengerService } from '../messenger/messenger.service';
import { CronJob } from 'cron';

@Injectable()
export class WebhookRegistrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookRegistrationService.name);
  private webhookCronJob: CronJob | null = null;

  constructor(
    private messengerService: MessengerService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    this.startWebhookRegistration();
  }

  onModuleDestroy() {
    this.stopWebhookRegistration();
  }

  /**
   * Start automatic webhook registration every 6 hours
   */
  private startWebhookRegistration(): void {
    // Get webhook URL from environment
    let webhookUrl = process.env.AVITO_WEBHOOK_URL || 'https://api.test-shem.ru/api/v1/webhooks/avito';
    
    // Clean up duplicate https://
    webhookUrl = webhookUrl.replace('https://https://', 'https://');
    
    this.logger.log(`🔗 Webhook URL configured: ${webhookUrl}`);

    // Schedule cron job: every 6 hours (0 */6 * * *)
    try {
      this.webhookCronJob = new CronJob(
        '0 */6 * * *',
        async () => {
          this.logger.log('⏰ Running scheduled webhook registration...');
          await this.registerWebhooksForAllAccounts(webhookUrl);
        },
        null,
        true, // Start immediately
        'Europe/Moscow'
      );

      this.schedulerRegistry.addCronJob('webhook-registration', this.webhookCronJob);
      this.logger.log('📡 Webhook registration cron job scheduled (every 6 hours)');
    } catch (error) {
      this.logger.error('Failed to schedule webhook registration cron job:', error);
    }

    // Run immediately on startup (with 5 second delay)
    setTimeout(() => {
      this.logger.log('🔄 Initial webhook registration on service startup...');
      this.registerWebhooksForAllAccounts(webhookUrl);
    }, 5000);
  }

  /**
   * Stop webhook registration
   */
  private stopWebhookRegistration(): void {
    if (this.webhookCronJob) {
      this.webhookCronJob.stop();
      this.webhookCronJob = null;
      this.logger.log('🛑 Webhook registration stopped');
    }
  }

  /**
   * Register webhooks for all accounts
   */
  private async registerWebhooksForAllAccounts(webhookUrl: string): Promise<void> {
    try {
      this.logger.log(`📡 Starting webhook registration for all accounts. URL: ${webhookUrl}`);
      
      const result = await this.messengerService.registerWebhooksForAll(webhookUrl);
      
      this.logger.log(`✅ Webhook registration completed:`, result);
    } catch (error: any) {
      this.logger.error(`❌ Failed to register webhooks:`, error.message || error);
    }
  }
}
