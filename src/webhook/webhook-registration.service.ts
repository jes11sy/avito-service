import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MessengerService } from '../messenger/messenger.service';

@Injectable()
export class WebhookRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(WebhookRegistrationService.name);
  private webhookUrl: string;

  constructor(private messengerService: MessengerService) {
    // Get webhook URL from environment
    let webhookUrl = process.env.AVITO_WEBHOOK_URL || 'https://api.lead-schem.ru/api/v1/webhooks/avito';
    
    // Clean up duplicate https://
    this.webhookUrl = webhookUrl.replace('https://https://', 'https://');
    
    this.logger.log(`🔗 Webhook URL configured: ${this.webhookUrl}`);
  }

  onModuleInit() {
    // Run immediately on startup (with 5 second delay)
    setTimeout(() => {
      this.logger.log('🔄 Initial webhook registration on service startup...');
      this.registerWebhooksForAllAccounts();
    }, 5000);
  }

  /**
   * Register webhooks every 6 hours
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleWebhookRegistrationCron() {
    this.logger.log('⏰ Running scheduled webhook registration...');
    await this.registerWebhooksForAllAccounts();
  }

  /**
   * Register webhooks for all accounts
   */
  private async registerWebhooksForAllAccounts(): Promise<void> {
    try {
      this.logger.log(`📡 Starting webhook registration for all accounts. URL: ${this.webhookUrl}`);
      
      const result = await this.messengerService.registerWebhooksForAll(this.webhookUrl);
      
      this.logger.log(`✅ Webhook registration completed:`, result);
    } catch (error: any) {
      this.logger.error(`❌ Failed to register webhooks:`, error.message || error);
    }
  }
}
