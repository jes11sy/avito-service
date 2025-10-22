import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AvitoModule } from './avito/avito.module';
import { WebhookModule } from './webhook/webhook.module';
import { AccountsModule } from './accounts/accounts.module';
import { EternalOnlineModule } from './eternal-online/eternal-online.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AvitoModule,
    WebhookModule,
    AccountsModule,
    EternalOnlineModule,
  ],
})
export class AppModule {}



