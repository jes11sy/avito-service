import { Module } from '@nestjs/common';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MessengerController],
  providers: [MessengerService],
  exports: [MessengerService],
})
export class MessengerModule {}

