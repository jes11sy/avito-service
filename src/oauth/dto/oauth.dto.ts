import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthAuthorizeDto {
  @ApiProperty({ 
    description: 'Scopes для авторизации (через запятую)',
    example: 'messenger:read,messenger:write,user:read,items:info',
    required: false 
  })
  @IsString()
  @IsOptional()
  scopes?: string;

  @ApiProperty({ 
    description: 'State для защиты от CSRF',
    required: false 
  })
  @IsString()
  @IsOptional()
  state?: string;
}

export class OAuthCallbackDto {
  @ApiProperty({ description: 'Authorization code от Avito' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'State для проверки', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'ID аккаунта для сохранения токенов' })
  @IsString()
  accountId: string;
}

export class OAuthTokenResponse {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty()
  expires_in: number;

  @ApiProperty()
  token_type: string;

  @ApiProperty()
  scope: string;
}

