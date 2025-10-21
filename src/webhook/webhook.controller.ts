import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';

@ApiTags('webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private webhookService: WebhookService) {}

  @Post('avito')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Avito webhook endpoint' })
  async avitoWebhook(@Body() payload: any) {
    this.logger.log(`Received Avito webhook: ${JSON.stringify(payload)}`);
    
    try {
      const result = await this.webhookService.processAvitoWebhook(payload);
      return result;
    } catch (error) {
      this.logger.error(`Error processing Avito webhook: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }
}

