import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly avitoOAuthUrl = 'https://avito.ru/oauth';
  private readonly avitoTokenUrl = 'https://api.avito.ru/token';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Генерация URL для авторизации пользователя
   */
  generateAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    scopes: string = 'messenger:read,messenger:write,user:read,items:info',
    state?: string,
  ): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.avitoOAuthUrl}?${params.toString()}`;
  }

  /**
   * Обмен authorization code на access_token и refresh_token
   */
  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    proxyConfig?: any,
  ): Promise<OAuthTokenResponse> {
    try {
      const axiosInstance = this.createAxiosInstance(proxyConfig);

      const response = await axiosInstance.post<OAuthTokenResponse>(
        this.avitoTokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.log('Successfully exchanged code for tokens');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to exchange code for tokens: ${error.message}`);
      throw new BadRequestException(
        `OAuth token exchange failed: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  /**
   * Обновление access_token с помощью refresh_token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    proxyConfig?: any,
  ): Promise<OAuthTokenResponse> {
    try {
      const axiosInstance = this.createAxiosInstance(proxyConfig);

      const response = await axiosInstance.post<OAuthTokenResponse>(
        this.avitoTokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.log('Successfully refreshed access token');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to refresh access token: ${error.message}`);
      throw new BadRequestException(
        `OAuth token refresh failed: ${error.response?.data?.error || error.message}`,
      );
    }
  }

  /**
   * Сохранение OAuth токенов в аккаунт
   * clientId = access_token
   * clientSecret = refresh_token
   */
  async saveTokensToAccount(
    accountId: number,
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    try {
      await this.prisma.avitoAccount.update({
        where: { id: accountId },
        data: {
          clientId: accessToken,
          clientSecret: refreshToken,
        },
      });

      this.logger.log(`OAuth tokens saved for account ${accountId}`);
    } catch (error: any) {
      this.logger.error(`Failed to save tokens: ${error.message}`);
      throw error;
    }
  }

  /**
   * Проверка и обновление токена если нужно
   * Возвращает актуальный access_token
   */
  async ensureValidToken(
    accountId: number,
    currentAccessToken: string,
    currentRefreshToken: string,
    originalClientId: string,
    originalClientSecret: string,
    proxyConfig?: any,
  ): Promise<string> {
    // Пытаемся использовать текущий токен
    // Если он невалиден, обновляем через refresh_token
    
    try {
      // Проверяем токен простым запросом
      const axiosInstance = this.createAxiosInstance(proxyConfig);
      await axiosInstance.get('https://api.avito.ru/core/v1/accounts/self', {
        headers: {
          Authorization: `Bearer ${currentAccessToken}`,
        },
      });

      // Токен валиден
      return currentAccessToken;
    } catch (error: any) {
      // Токен невалиден, обновляем
      this.logger.log(`Access token expired for account ${accountId}, refreshing...`);

      const tokens = await this.refreshAccessToken(
        currentRefreshToken,
        originalClientId,
        originalClientSecret,
        proxyConfig,
      );

      // Сохраняем новые токены
      await this.saveTokensToAccount(accountId, tokens.access_token, tokens.refresh_token);

      return tokens.access_token;
    }
  }

  /**
   * Создание axios instance с прокси
   */
  private createAxiosInstance(proxyConfig?: any): AxiosInstance {
    const config: any = {
      timeout: 30000,
    };

    if (proxyConfig) {
      const { host, port, protocol, auth } = proxyConfig;

      if (protocol === 'socks4' || protocol === 'socks5') {
        const proxyUrl = auth
          ? `${protocol}://${auth.username}:${auth.password}@${host}:${port}`
          : `${protocol}://${host}:${port}`;
        config.httpAgent = new SocksProxyAgent(proxyUrl);
        config.httpsAgent = new SocksProxyAgent(proxyUrl);
      } else {
        const proxyUrl = auth
          ? `${protocol}://${auth.username}:${auth.password}@${host}:${port}`
          : `${protocol}://${host}:${port}`;
        config.httpsAgent = new HttpsProxyAgent(proxyUrl);
      }
    }

    return axios.create(config);
  }
}

