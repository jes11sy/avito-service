import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts/accounts.service';
import { RolesGuard, Roles, UserRole } from './auth/roles.guard';

@ApiTags('messenger')
@Controller('messenger')
export class AvitoMessengerController {
  constructor(private accountsService: AccountsService) {}

  @Get('accounts/:accountId/chats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR)
  @ApiOperation({ summary: 'Get chats from Avito API' })
  async getChats(@Param('accountId', ParseIntPipe) accountId: number) {
    const messengerClient = await this.accountsService.getMessengerClient(accountId);
    const chats = await messengerClient.getChats();

    return {
      success: true,
      data: chats,
    };
  }

  @Get('accounts/:accountId/chats/:chatId/messages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR)
  @ApiOperation({ summary: 'Get chat messages from Avito API' })
  async getMessages(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
  ) {
    const messengerClient = await this.accountsService.getMessengerClient(accountId);
    const messages = await messengerClient.getMessages(chatId, limit ? parseInt(limit) : 100);

    return {
      success: true,
      data: messages,
    };
  }

  @Post('accounts/:accountId/chats/:chatId/send')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send message to Avito chat' })
  async sendMessage(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('chatId') chatId: string,
    @Body() body: { text: string },
  ) {
    const messengerClient = await this.accountsService.getMessengerClient(accountId);
    const result = await messengerClient.sendMessage(chatId, body.text);

    return {
      success: true,
      message: 'Message sent successfully',
      data: result,
    };
  }

  @Post('accounts/:accountId/chats/:chatId/messages/:messageId/read')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark message as read' })
  async markAsRead(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    const messengerClient = await this.accountsService.getMessengerClient(accountId);
    await messengerClient.markAsRead(chatId, messageId);

    return {
      success: true,
      message: 'Message marked as read',
    };
  }

  @Post('accounts/:accountId/status/online')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set online status' })
  async setOnline(@Param('accountId', ParseIntPipe) accountId: number) {
    const messengerClient = await this.accountsService.getMessengerClient(accountId);
    await messengerClient.setOnline();

    return {
      success: true,
      message: 'Status set to online',
    };
  }
}

