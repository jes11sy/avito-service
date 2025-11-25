import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { AccountsModule } from './accounts/accounts.module';
import { EternalOnlineModule } from './eternal-online/eternal-online.module';
import { MessengerModule } from './messenger/messenger.module';
import { WebhookModule } from './webhook/webhook.module';
import { OAuthModule } from './oauth/oauth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
    CommonModule,
    PrismaModule,
    AuthModule,
    AccountsModule,
    EternalOnlineModule,
    MessengerModule,
    WebhookModule,
    OAuthModule,
  ],
})
export class AppModule {}



