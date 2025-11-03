import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private accountsService: AccountsService,
    private prisma: PrismaService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    const dbHealthy = await this.prisma.healthCheck();
    const dbStats = this.prisma.getStats();
    
    return {
      success: true,
      message: 'Avito Service is healthy',
      timestamp: new Date().toISOString(),
      database: {
        healthy: dbHealthy,
        ...dbStats,
      },
    };
  }

  @Get('stats/database')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get database statistics and connection pool info' })
  async getDatabaseStats() {
    const stats = this.prisma.getStats();
    const healthy = await this.prisma.healthCheck();
    
    return {
      success: true,
      data: {
        healthy,
        ...stats,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('check-all-connections')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check all accounts connections' })
  async checkAllConnections() {
    return this.accountsService.checkAllConnections();
  }

  @Post('check-all-proxies')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check all accounts proxies' })
  async checkAllProxies() {
    return this.accountsService.checkAllProxies();
  }

  @Post('sync-all-stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync statistics for all accounts' })
  async syncAllStats() {
    return this.accountsService.syncAllAccountsStats();
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get all Avito accounts' })
  async getAccounts() {
    return this.accountsService.getAccounts();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get account by ID' })
  async getAccount(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.getAccount(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create Avito account' })
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.accountsService.createAccount(dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update account' })
  async updateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.accountsService.updateAccount(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete account' })
  async deleteAccount(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.deleteAccount(id);
  }

  @Post(':id/check-connection')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check API and proxy connection' })
  async checkConnection(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.checkConnection(id);
  }

  @Post(':id/sync-stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync account statistics' })
  async syncStats(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.syncAccountStats(id);
  }

  @Post(':id/check-proxy')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check account proxy' })
  async checkProxy(@Param('id', ParseIntPipe) id: number) {
    const apiClient = await this.accountsService.getApiClient(id);
    const isProxyOk = await apiClient.proxyCheck();
    
    await this.prisma.avito.update({
      where: { id },
      data: {
        proxyStatus: isProxyOk ? 'connected' : 'disconnected',
      },
    });

    return {
      success: true,
      data: {
        proxyStatus: isProxyOk ? 'connected' : 'disconnected',
      },
    };
  }
}

