import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MessengerService } from './messenger.service';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('avito-messenger')
@Controller('avito-messenger')
export class MessengerController {
  constructor(private messengerService: MessengerService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    return {
      success: true,
      message: 'Avito Messenger module is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('accounts')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all Avito accounts for messenger' })
  async getAccounts() {
    return this.messengerService.getAccounts();
  }

  @Get('chats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get chats for account' })
  async getChats(
    @Query('avitoAccountName') avitoAccountName: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('unread_only') unread_only?: string,
    @Query('limit') limit?: string,
  ) {
    const isUnreadOnly = (unreadOnly === 'true') || (unread_only === 'true');
    return this.messengerService.getChats(
      avitoAccountName,
      isUnreadOnly,
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('chats/:chatId/messages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get messages for chat' })
  async getMessages(
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('avitoAccountName') avitoAccountName?: string,
  ) {
    return this.messengerService.getMessages(chatId, avitoAccountName, limit ? parseInt(limit) : 100);
  }

  @Post('chats/:chatId/messages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send message to chat' })
  async sendMessage(
    @Param('chatId') chatId: string,
    @Body() body: { text: string; avitoAccountName: string },
  ) {
    return this.messengerService.sendMessage(chatId, body.text, body.avitoAccountName);
  }

  @Post('chats/:chatId/read')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark chat as read' })
  async markChatAsRead(
    @Param('chatId') chatId: string,
    @Body() body: { avitoAccountName: string },
  ) {
    return this.messengerService.markChatAsRead(chatId, body.avitoAccountName);
  }

  @Get('voice-files')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get voice files for account' })
  async getVoiceFiles(@Query('avitoAccountName') avitoAccountName: string) {
    return this.messengerService.getVoiceFiles(avitoAccountName);
  }

  @Post('webhook/register-all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register webhooks for all accounts' })
  async registerWebhooks(@Body() body: { webhookUrl: string }) {
    return this.messengerService.registerWebhooksForAll(body.webhookUrl);
  }
}

