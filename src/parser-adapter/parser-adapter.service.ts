import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface ParserAccount {
  id: number;
  login: string;
  password: string;
  cookies?: string;
  proxyHost?: string;
  proxyPort?: number;
  proxyType?: string;
  proxyLogin?: string;
  proxyPassword?: string;
}

@Injectable()
export class ParserAdapterService {
  private readonly logger = new Logger(ParserAdapterService.name);
  private readonly parserUrl: string;
  private readonly axiosInstance: AxiosInstance;

  constructor() {
    this.parserUrl = process.env.PARSER_SERVICE_URL || 'http://avito-parser-service:5011/api/v1';
    this.axiosInstance = axios.create({
      baseURL: this.parserUrl,
      timeout: 60000, // 60 секунд для парсинга
    });
  }

  /**
   * Авторизация через парсер
   */
  async login(account: ParserAccount): Promise<string> {
    try {
      const response = await this.axiosInstance.post('/parser/login', { account });
      if (response.data.success) {
        return response.data.cookies;
      }
      throw new Error(response.data.error || 'Login failed');
    } catch (error: any) {
      this.logger.error(`Parser login failed for account ${account.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Получить чаты через парсер
   */
  async getChats(account: ParserAccount): Promise<{ data: any[], cookies?: string }> {
    try {
      const response = await this.axiosInstance.post('/parser/chats', { account });
      if (response.data.success) {
        return {
          data: response.data.data,
          cookies: response.data.cookies,
        };
      }
      throw new Error(response.data.error || 'Get chats failed');
    } catch (error: any) {
      this.logger.error(`Parser get chats failed for account ${account.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Получить сообщения через парсер
   */
  async getMessages(account: ParserAccount, chatId: string): Promise<{ data: any[], cookies?: string }> {
    try {
      const response = await this.axiosInstance.post('/parser/messages', { account, chatId });
      if (response.data.success) {
        return {
          data: response.data.data,
          cookies: response.data.cookies,
        };
      }
      throw new Error(response.data.error || 'Get messages failed');
    } catch (error: any) {
      this.logger.error(`Parser get messages failed for account ${account.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Отправить сообщение через парсер
   */
  async sendMessage(account: ParserAccount, chatId: string, message: string): Promise<{ success: boolean, cookies?: string }> {
    try {
      const response = await this.axiosInstance.post('/parser/send', { account, chatId, message });
      return {
        success: response.data.success,
        cookies: response.data.cookies,
      };
    } catch (error: any) {
      this.logger.error(`Parser send message failed for account ${account.id}:`, error.message);
      throw error;
    }
  }
}

