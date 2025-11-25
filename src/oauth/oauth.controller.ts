import { Controller, Get, Query, Param, Res, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { OAuthService } from './oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('OAuth')
@Controller('auth/avito')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Шаг 1: Редирект пользователя на Avito для авторизации
   */
  @Get('authorize/:accountId')
  @ApiOperation({ summary: 'Начать OAuth авторизацию для аккаунта' })
  @ApiParam({ name: 'accountId', description: 'ID аккаунта' })
  async authorize(
    @Param('accountId') accountId: string,
    @Res() reply: FastifyReply,
  ) {
    try {
      // Проверяем что аккаунт существует
      const account = await this.prisma.avito.findUnique({
        where: { id: parseInt(accountId) },
      });

      if (!account) {
        throw new NotFoundException(`Account ${accountId} not found`);
      }

      const clientId = this.config.get<string>('AVITO_OAUTH_CLIENT_ID');
      const redirectUri = this.config.get<string>('AVITO_OAUTH_REDIRECT_URI');
      const scopes = this.config.get<string>('AVITO_OAUTH_SCOPES') || 'messenger:read,messenger:write,user:read';

      if (!clientId || !redirectUri) {
        throw new BadRequestException('OAuth configuration missing in environment variables');
      }

      // Генерируем state для защиты от CSRF (используем accountId)
      const state = Buffer.from(JSON.stringify({ accountId })).toString('base64');

      const authUrl = this.oauthService.generateAuthorizationUrl(
        clientId,
        redirectUri,
        scopes,
        state,
      );

      this.logger.log(`Redirecting account ${accountId} to Avito OAuth`);

      // Редиректим на Avito
      return reply.redirect(302, authUrl);
    } catch (error: any) {
      this.logger.error(`Authorization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Шаг 2: Callback от Avito с authorization code
   */
  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback от Avito' })
  @ApiQuery({ name: 'code', description: 'Authorization code от Avito' })
  @ApiQuery({ name: 'state', description: 'State для проверки', required: false })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() reply: FastifyReply,
  ) {
    try {
      if (!code) {
        throw new BadRequestException('Authorization code is missing');
      }

      // Декодируем state чтобы получить accountId
      let accountId: number;
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        accountId = parseInt(decoded.accountId);
      } catch (error) {
        throw new BadRequestException('Invalid state parameter');
      }

      // Проверяем что аккаунт существует
      const account = await this.prisma.avito.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new NotFoundException(`Account ${accountId} not found`);
      }

      const clientId = this.config.get<string>('AVITO_OAUTH_CLIENT_ID');
      const clientSecret = this.config.get<string>('AVITO_OAUTH_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        throw new BadRequestException('OAuth configuration missing');
      }

      // Собираем прокси конфиг если есть
      const proxyConfig = account.proxyHost
        ? {
            host: account.proxyHost,
            port: account.proxyPort,
            protocol: account.proxyType,
            auth: account.proxyLogin
              ? {
                  username: account.proxyLogin,
                  password: account.proxyPassword,
                }
              : undefined,
          }
        : undefined;

      // Обмениваем code на токены
      const tokens = await this.oauthService.exchangeCodeForTokens(
        code,
        clientId,
        clientSecret,
        proxyConfig,
      );

      // Сохраняем токены в аккаунт
      // clientId = access_token
      // clientSecret = refresh_token
      await this.oauthService.saveTokensToAccount(
        accountId,
        tokens.access_token,
        tokens.refresh_token,
      );

      this.logger.log(`OAuth tokens saved for account ${accountId}`);

      // Редиректим на фронтенд с успехом (на страницу редактирования в админке)
      const frontendUrl = this.config.get<string>('CORS_ORIGIN')?.split(',')[0] || 'https://lead-schem.ru';
      return reply.redirect(302, `${frontendUrl}/avito/edit/${accountId}?oauth=success`);
    } catch (error: any) {
      this.logger.error(`OAuth callback failed: ${error.message}`);
      
      // Редиректим на фронтенд с ошибкой (на страницу списка аккаунтов в админке)
      const frontendUrl = this.config.get<string>('CORS_ORIGIN')?.split(',')[0] || 'https://lead-schem.ru';
      return reply.redirect(302, `${frontendUrl}/avito?oauth=error&message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Ручное обновление токена (для тестирования)
   */
  @Get('refresh/:accountId')
  @ApiOperation({ summary: 'Обновить OAuth токен вручную' })
  @ApiParam({ name: 'accountId', description: 'ID аккаунта' })
  async refreshToken(@Param('accountId') accountId: string) {
    try {
      const account = await this.prisma.avito.findUnique({
        where: { id: parseInt(accountId) },
      });

      if (!account) {
        throw new NotFoundException(`Account ${accountId} not found`);
      }

      if (!account.clientSecret) {
        throw new BadRequestException('No refresh token found for this account');
      }

      const clientId = this.config.get<string>('AVITO_OAUTH_CLIENT_ID');
      const clientSecret = this.config.get<string>('AVITO_OAUTH_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        throw new BadRequestException('OAuth configuration missing');
      }

      const proxyConfig = account.proxyHost
        ? {
            host: account.proxyHost,
            port: account.proxyPort,
            protocol: account.proxyType,
            auth: account.proxyLogin
              ? {
                  username: account.proxyLogin,
                  password: account.proxyPassword,
                }
              : undefined,
          }
        : undefined;

      // Обновляем токен
      const tokens = await this.oauthService.refreshAccessToken(
        account.clientSecret, // refresh_token
        clientId,
        clientSecret,
        proxyConfig,
      );

      // Сохраняем новые токены
      await this.oauthService.saveTokensToAccount(
        parseInt(accountId),
        tokens.access_token,
        tokens.refresh_token,
      );

      this.logger.log(`Token refreshed for account ${accountId}`);

      return {
        success: true,
        message: 'Token refreshed successfully',
        expiresIn: tokens.expires_in,
      };
    } catch (error: any) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw error;
    }
  }
}

