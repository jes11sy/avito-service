import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

interface ProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  auth?: {
    username: string;
    password: string;
  };
}

interface AvitoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AvitoAccountInfo {
  id: number;
  name: string;
  email: string;
  phone: string;
  phones: string[];
  profile_url: string;
}

export interface AvitoBalance {
  real: number;
  bonus: number;
}

interface AvitoItemsStats {
  count: number;
  active_count: number;
  inactive_count: number;
}

interface AvitoItemStats {
  item_id: number;
  views: number;
  contacts: number;
  favorites: number;
}

export interface AvitoCPABalance {
  balance: number; // в копейках
}

export interface AvitoAggregatedStats {
  totalViews: number;
  totalContacts: number;
  adsCount: number;
}

@Injectable()
export class AvitoApiService {
  private readonly logger = new Logger(AvitoApiService.name);
  private readonly baseUrl = 'https://api.avito.ru';
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private proxyConfig?: ProxyConfig,
  ) {
    this.axiosInstance = this.createAxiosInstance();
  }

  private createAxiosInstance(): AxiosInstance {
    const config: any = {
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Настройка прокси
    if (this.proxyConfig) {
      const { host, port, protocol, auth } = this.proxyConfig;
      
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

      this.logger.log(`Proxy configured: ${protocol}://${host}:${port}`);
    }

    return axios.create(config);
  }

  /**
   * Получить access token
   */
  async getAccessToken(): Promise<string> {
    // Проверяем, есть ли валидный токен
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken;
    }

    try {
      const response = await this.axiosInstance.post<AvitoTokenResponse>(
        '/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);

      this.logger.log('Access token obtained successfully');

      return this.accessToken;
    } catch (error: any) {
      this.logger.error(`Failed to get access token: ${error.message}`);
      throw new Error(`Avito API token error: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Получить информацию об аккаунте
   */
  async getAccountInfo(): Promise<AvitoAccountInfo> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get<AvitoAccountInfo>('/core/v1/accounts/self', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get account info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить баланс аккаунта
   */
  async getBalance(): Promise<AvitoBalance> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get<AvitoBalance>('/core/v1/accounts/balance', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить статистику объявлений
   */
  async getItemsStats(userId: number): Promise<AvitoItemsStats> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get<AvitoItemsStats>(
        `/core/v1/accounts/${userId}/items/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get items stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить статистику по объявлению
   */
  async getItemStats(itemId: number, dateFrom: string, dateTo: string): Promise<AvitoItemStats> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.post<AvitoItemStats>(
        '/stats/v1/accounts/items/stats',
        {
          items: [{ itemId }],
          periodGrouping: 'day',
          dateFrom,
          dateTo,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get item stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Проверка здоровья API
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Проверка прокси
   */
  async proxyCheck(): Promise<boolean> {
    if (!this.proxyConfig) {
      return true; // Прокси не настроен
    }

    try {
      await this.axiosInstance.get('https://api.avito.ru/core/v1/accounts/self', {
        timeout: 10000,
      });
      return true;
    } catch (error) {
      this.logger.error(`Proxy check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Получить CPA баланс (в копейках)
   */
  async getCPABalance(): Promise<AvitoCPABalance> {
    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.post<AvitoCPABalance>(
        '/cpa/v3/balanceInfo',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Source': 'avito-service',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get CPA balance: ${error.message}`);
      // Возвращаем 0 если нет CPA тарифа
      return { balance: 0 };
    }
  }

  /**
   * Получить агрегированную статистику по всем объявлениям
   */
  async getAggregatedStats(userId: number, dateFrom?: string, dateTo?: string): Promise<AvitoAggregatedStats> {
    const token = await this.getAccessToken();

    // Используем последние 30 дней если даты не указаны
    if (!dateFrom || !dateTo) {
      const now = new Date();
      dateTo = now.toISOString().split('T')[0];
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      dateFrom = from.toISOString().split('T')[0];
    }

    try {
      // Получаем список объявлений
      const itemsResponse = await this.axiosInstance.get(
        `/core/v1/accounts/${userId}/items`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const items = itemsResponse.data?.resources || [];
      
      if (items.length === 0) {
        return {
          totalViews: 0,
          totalContacts: 0,
          adsCount: 0,
        };
      }

      // Получаем статистику по объявлениям (можно группами по 200)
      const itemIds = items.map((item: any) => item.id).slice(0, 200);
      
      const statsResponse = await this.axiosInstance.post(
        `/stats/v1/accounts/${userId}/items`,
        {
          dateFrom,
          dateTo,
          itemIds,
          fields: ['uniqViews', 'uniqContacts'],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const statsData = statsResponse.data?.result?.items || [];
      
      let totalViews = 0;
      let totalContacts = 0;

      statsData.forEach((item: any) => {
        if (item.stats && Array.isArray(item.stats)) {
          item.stats.forEach((stat: any) => {
            totalViews += stat.uniqViews || 0;
            totalContacts += stat.uniqContacts || 0;
          });
        }
      });

      return {
        totalViews,
        totalContacts,
        adsCount: items.length,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get aggregated stats: ${error.message}`);
      // Возвращаем 0 при ошибке
      return {
        totalViews: 0,
        totalContacts: 0,
        adsCount: 0,
      };
    }
  }
}

