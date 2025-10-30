import { Injectable, LoggerService } from '@nestjs/common';
import { Logger } from '@nestjs/common';

interface SensitiveField {
  path: string;
  maskType: 'full' | 'partial' | 'hash';
}

@Injectable()
export class SafeLogger implements LoggerService {
  private readonly logger = new Logger('SafeLogger');
  
  private readonly sensitiveFields: SensitiveField[] = [
    { path: 'clientSecret', maskType: 'full' },
    { path: 'client_secret', maskType: 'full' },
    { path: 'proxyPassword', maskType: 'full' },
    { path: 'proxy_password', maskType: 'full' },
    { path: 'password', maskType: 'full' },
    { path: 'token', maskType: 'partial' },
    { path: 'accessToken', maskType: 'partial' },
    { path: 'access_token', maskType: 'partial' },
    { path: 'refreshToken', maskType: 'partial' },
    { path: 'authorization', maskType: 'partial' },
    { path: 'Authorization', maskType: 'partial' },
  ];

  /**
   * Sanitize object by masking sensitive fields
   */
  private sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        const field = this.sensitiveFields.find(f => 
          f.path.toLowerCase() === key.toLowerCase()
        );
        
        if (field) {
          sanitized[key] = this.maskValue(value, field.maskType);
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * Mask value based on mask type
   */
  private maskValue(value: any, maskType: 'full' | 'partial' | 'hash'): string {
    if (!value) return '***';
    
    const strValue = String(value);
    
    switch (maskType) {
      case 'full':
        return '***';
      
      case 'partial':
        if (strValue.length <= 10) return '***';
        return `${strValue.substring(0, 8)}...***`;
      
      case 'hash':
        // Show hash of value for debugging purposes
        const hash = require('crypto')
          .createHash('md5')
          .update(strValue)
          .digest('hex')
          .substring(0, 8);
        return `hash:${hash}`;
      
      default:
        return '***';
    }
  }

  /**
   * Log with automatic sanitization
   */
  log(message: any, context?: string, data?: any) {
    if (data) {
      this.logger.log(message, this.sanitize(data), context);
    } else {
      this.logger.log(message, context);
    }
  }

  /**
   * Error log with sanitization
   */
  error(message: any, trace?: string, context?: string, data?: any) {
    if (data) {
      this.logger.error(message, this.sanitize(data), trace, context);
    } else {
      this.logger.error(message, trace, context);
    }
  }

  /**
   * Warning log with sanitization
   */
  warn(message: any, context?: string, data?: any) {
    if (data) {
      this.logger.warn(message, this.sanitize(data), context);
    } else {
      this.logger.warn(message, context);
    }
  }

  /**
   * Debug log with sanitization
   */
  debug(message: any, context?: string, data?: any) {
    if (data) {
      this.logger.debug(message, this.sanitize(data), context);
    } else {
      this.logger.debug(message, context);
    }
  }

  /**
   * Verbose log with sanitization
   */
  verbose(message: any, context?: string, data?: any) {
    if (data) {
      this.logger.verbose(message, this.sanitize(data), context);
    } else {
      this.logger.verbose(message, context);
    }
  }

  /**
   * Manually sanitize data (useful for custom logging)
   */
  sanitizeData(data: any): any {
    return this.sanitize(data);
  }

  /**
   * Create context logger with safe logging
   */
  createContextLogger(context: string) {
    return {
      log: (message: any, data?: any) => this.log(message, context, data),
      error: (message: any, trace?: string, data?: any) => this.error(message, trace, context, data),
      warn: (message: any, data?: any) => this.warn(message, context, data),
      debug: (message: any, data?: any) => this.debug(message, context, data),
      verbose: (message: any, data?: any) => this.verbose(message, context, data),
    };
  }
}

