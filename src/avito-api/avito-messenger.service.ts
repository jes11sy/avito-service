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

export interface AvitoChat {
  id: string;
  context: {
    type: string;
    value: {
      id: number;
      title: string;
      price_string?: string;
      url: string;
      images?: {
        main?: {
          '140x105'?: string;
        };
      };
      status_id?: number;
      location?: {
        lat?: number;
        lon?: number;
        title?: string;
        city_name?: string;
        region_name?: string;
        district_name?: string;
      };
    };
  };
  users: Array<{
    id: number;
    name: string;
    public_user_profile?: {
      avatar?: {
        default?: string;
        images?: {
          '24x24'?: string;
          '36x36'?: string;
          '48x48'?: string;
          '64x64'?: string;
          '72x72'?: string;
          '96x96'?: string;
          '128x128'?: string;
          '192x192'?: string;
          '256x256'?: string;
        };
      };
      url?: string;
      user_id?: number;
      item_id?: number;
    };
  }>;
  created: number;
  updated: number;
  last_message?: {
    id: string;
    author_id: number;
    content: {
      text?: string;
      [key: string]: any;
    };
    created: number;
    direction: 'in' | 'out';
    type: string;
    is_read?: boolean;
    read?: number | null;
  };
}

export interface AvitoMessage {
  id: string;
  type: string;
  direction: 'in' | 'out';
  content: {
    text?: string;
    [key: string]: any;
  };
  author_id: string;
  created: string;
  read: boolean;
}

@Injectable()
export class AvitoMessengerService {
  private readonly logger = new Logger(AvitoMessengerService.name);
  private readonly baseUrl = 'https://api.avito.ru/messenger';
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private userId: number,
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
    }

    const instance = axios.create(config);

    // Add request interceptor for automatic token refresh
    instance.interceptors.request.use(async (cfg) => {
      try {
        const token = await this.getAccessToken();
        if (token) {
          cfg.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        this.logger.error('Failed to get access token for request', error);
      }
      return cfg;
    });

    return instance;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      this.logger.debug(`🔐 Requesting access token for userId: ${this.userId}`, {
        clientId: this.clientId?.substring(0, 10) + '...',
      });

      const response = await axios.post(
        'https://api.avito.ru/token',
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
      this.logger.debug(`✅ Access token obtained for userId: ${this.userId}`);
      return this.accessToken;
    } catch (error: any) {
      this.logger.error(`❌ Failed to get access token for userId: ${this.userId}`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Получить список чатов
   */
  async getChats(unreadOnly: boolean = false, limit?: number): Promise<AvitoChat[]> {
    const token = await this.getAccessToken();

    try {
      const params: any = {};
      
      if (unreadOnly) {
        params.unread_only = true;
      }
      
      if (limit) {
        params.limit = limit;
      }

      const response = await this.axiosInstance.get(`/v2/accounts/${this.userId}/chats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return response.data.chats || [];
    } catch (error: any) {
      this.logger.error(`Failed to get chats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить сообщения чата (v3 API)
   */
  async getMessages(chatId: string, limit: number = 100): Promise<AvitoMessage[]> {
    const token = await this.getAccessToken();

    try {
      // Use v3 API endpoint
      const response = await axios.get(
        `https://api.avito.ru/messenger/v3/accounts/${this.userId}/chats/${chatId}/messages/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            limit,
          },
          httpsAgent: this.axiosInstance.defaults.httpsAgent,
          httpAgent: this.axiosInstance.defaults.httpAgent,
        }
      );

      return response.data || [];
    } catch (error: any) {
      this.logger.error(`Failed to get messages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Отправить сообщение (v1 API)
   */
  async sendMessage(chatId: string, text: string): Promise<any> {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `https://api.avito.ru/messenger/v1/accounts/${this.userId}/chats/${chatId}/messages`,
        {
          type: 'text',
          message: {
            text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.axiosInstance.defaults.httpsAgent,
          httpAgent: this.axiosInstance.defaults.httpAgent,
        }
      );

      this.logger.log(`✅ Message sent to chat ${chatId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Failed to send message: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Отметить чат как прочитанный (v1 API)
   */
  async markAsRead(chatId: string): Promise<void> {
    const token = await this.getAccessToken();

    try {
      // Use v1 API endpoint for marking chat as read
      await axios.post(
        `https://api.avito.ru/messenger/v1/accounts/${this.userId}/chats/${chatId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          httpsAgent: this.axiosInstance.defaults.httpsAgent,
          httpAgent: this.axiosInstance.defaults.httpAgent,
        }
      );

      this.logger.log(`Chat ${chatId} marked as read`);
    } catch (error: any) {
      this.logger.error(`Failed to mark chat as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * Установить статус "онлайн"
   */
  async setOnline(): Promise<void> {
    const token = await this.getAccessToken();

    try {
      await this.axiosInstance.post(
        `/v2/accounts/${this.userId}/status/online`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      this.logger.log('Status set to online');
    } catch (error: any) {
      this.logger.error(`Failed to set online: ${error.message}`);
      // Не бросаем ошибку, так как это не критично
    }
  }

  /**
   * Register webhook URL for notifications
   */
  async registerWebhook(webhookUrl: string): Promise<boolean> {
    try {
      this.logger.log(`📡 Attempting to register webhook for user ${this.userId}`, {
        webhookUrl,
        userId: this.userId
      });
      
      const response = await this.axiosInstance.post(
        `/v3/webhook`,
        { url: webhookUrl }
      );
      
      this.logger.log(`📨 Webhook API response:`, {
        status: response.status,
        data: response.data,
        userId: this.userId
      });
      
      const success = response.data.ok === true;
      
      if (success) {
        this.logger.log(`✅ Webhook registered successfully for user ${this.userId}`);
      } else {
        this.logger.warn(`⚠️ Webhook registration response: ${JSON.stringify(response.data)}`);
      }
      
      return success;
    } catch (error: any) {
      this.logger.error(`❌ Failed to register webhook:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        userId: this.userId
      });
      throw error;
    }
  }
}

