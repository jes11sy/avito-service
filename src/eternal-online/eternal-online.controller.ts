import { Controller, Post, Param, Body, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EternalOnlineService } from './eternal-online.service';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('eternal-online')
@Controller('eternal-online')
export class EternalOnlineController {
  constructor(private eternalOnlineService: EternalOnlineService) {}

  @Post('accounts/:accountId/enable')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable eternal online for account' })
  async enableEternalOnline(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() body: { interval?: number },
  ) {
    return this.eternalOnlineService.enableEternalOnline(accountId, body.interval);
  }

  @Post('accounts/:accountId/disable')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable eternal online for account' })
  async disableEternalOnline(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.eternalOnlineService.disableEternalOnline(accountId);
  }

  @Post('accounts/:accountId/set-online')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.CALLCENTRE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually set account online' })
  async setAccountOnline(@Param('accountId', ParseIntPipe) accountId: number) {
    await this.eternalOnlineService.setAccountOnline(accountId);
    return {
      success: true,
      message: 'Account set to online',
    };
  }
}

