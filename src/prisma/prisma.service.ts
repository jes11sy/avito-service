import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private queryCount = 0;
  private errorCount = 0;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // ✅ ОПТИМИЗИРОВАНО: Avito Service - средняя/высокая нагрузка
    // Интеграция с Avito API, мессенджер, объявления
    const databaseUrl = process.env.DATABASE_URL || '';
    const hasParams = databaseUrl.includes('?');
    
    const connectionParams = [
      'connection_limit=30',      // Высокое значение для API интеграции
      'pool_timeout=20',
      'connect_timeout=10',
      'socket_timeout=60',
    ];
    
    const needsParams = !databaseUrl.includes('connection_limit');
    const enhancedUrl = needsParams
      ? `${databaseUrl}${hasParams ? '&' : '?'}${connectionParams.join('&')}`
      : databaseUrl;

    super({
      datasources: {
        db: {
          url: enhancedUrl,
        },
      },
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    if (needsParams) {
      this.logger.log('✅ Connection pool configured: limit=30');
    }

    // Monitor query performance
    // @ts-ignore - Prisma event types
    this.$on('warn', (e: any) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });

    // @ts-ignore - Prisma event types
    this.$on('error', (e: any) => {
      this.errorCount++;
      this.logger.error(`Prisma Error: ${e.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      
      // Get connection pool info (if available)
      const poolInfo = this.getConnectionPoolInfo();
      
      this.logger.log('✅ Database connected');
      this.logger.log(`📊 Connection Pool: ${poolInfo}`);
      
      // Log slow queries in production
      if (process.env.NODE_ENV === 'production') {
        this.enableSlowQueryLogging();
      }
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('✅ Database disconnected');
  }

  /**
   * Get connection pool configuration
   */
  private getConnectionPoolInfo(): string {
    const url = process.env.DATABASE_URL || '';
    const params = new URLSearchParams(url.split('?')[1] || '');
    
    const connectionLimit = params.get('connection_limit') || '10 (default)';
    const poolTimeout = params.get('pool_timeout') || '10 (default)';
    const connectTimeout = params.get('connect_timeout') || '5 (default)';
    
    return `Limit: ${connectionLimit}, Pool Timeout: ${poolTimeout}s, Connect Timeout: ${connectTimeout}s`;
  }

  /**
   * Enable slow query logging (queries > 1000ms)
   */
  private enableSlowQueryLogging() {
    this.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;

      this.queryCount++;

      // Log slow queries (> 1 second)
      if (duration > 1000) {
        this.logger.warn(
          `🐌 Slow Query Detected: ${params.model}.${params.action} took ${duration}ms`
        );
      }

      // Log very slow queries (> 3 seconds)
      if (duration > 3000) {
        this.logger.error(
          `🔴 Very Slow Query: ${params.model}.${params.action} took ${duration}ms`
        );
      }

      return result;
    });

    this.logger.log('🔍 Slow query logging enabled (threshold: 1000ms)');
  }

  /**
   * Get database statistics
   */
  getStats() {
    return {
      totalQueries: this.queryCount,
      totalErrors: this.errorCount,
      poolInfo: this.getConnectionPoolInfo(),
    };
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}





















