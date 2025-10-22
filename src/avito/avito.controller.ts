import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AvitoService } from './avito.service';
import { CreateAvitoDto, UpdateAvitoDto } from './dto/avito.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('avito')
@Controller('avito')
export class AvitoController {
  constructor(private avitoService: AvitoService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    return {
      success: true,
      message: 'Avito module is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('chats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get all Avito chats' })
  async getChats(@Query() query: any) {
    return this.avitoService.getChats(query);
  }

  @Get('chats/:chatId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get chat by ID with messages' })
  async getChat(@Param('chatId') chatId: string) {
    return this.avitoService.getChat(chatId);
  }

  @Get('chats/:chatId/messages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get chat messages' })
  async getChatMessages(@Param('chatId') chatId: string) {
    return this.avitoService.getChatMessages(chatId);
  }

  @Post('chats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Create Avito chat manually' })
  async createChat(@Body() dto: CreateAvitoDto) {
    return this.avitoService.createChat(dto);
  }

  @Put('chats/:chatId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Update chat' })
  async updateChat(@Param('chatId') chatId: string, @Body() dto: UpdateAvitoDto) {
    return this.avitoService.updateChat(chatId, dto);
  }

  @Get('chats/by-phone/:phone')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN, UserRole.CALLCENTRE_OPERATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get chats by phone number' })
  async getChatsByPhone(@Param('phone') phone: string) {
    return this.avitoService.getChatsByPhone(phone);
  }
}




