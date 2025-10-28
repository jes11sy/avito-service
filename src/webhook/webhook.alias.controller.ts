import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookController } from './webhook.controller';

@ApiTags('webhooks')
@Controller('webhook/avito')
export class WebhookAliasController extends WebhookController {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alias: handle Avito webhook on /webhook/avito' })
  async alias(@Body() event: any) {
    return this.handleWebhook(event);
  }
}


