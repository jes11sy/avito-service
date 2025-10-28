import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookController } from './webhook.controller';

@ApiTags('webhooks')
@Controller('webhook/avito')
export class WebhookAliasController extends WebhookController {
  constructor(prisma: PrismaService) {
    super(prisma);
  }
}


