import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientSecret?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avitoLogin?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avitoPassword?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  useParser?: boolean;

  @ApiProperty({ required: false, enum: ['http', 'https', 'socks4', 'socks5'] })
  @IsString()
  @IsOptional()
  proxyType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proxyHost?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  proxyPort?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proxyLogin?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proxyPassword?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  eternalOnlineEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(60)
  @Max(3600)
  @IsOptional()
  onlineKeepAliveInterval?: number;
}

export class UpdateAccountDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clientSecret?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avitoLogin?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avitoPassword?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  useParser?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proxyType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proxyHost?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  proxyPort?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proxyLogin?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proxyPassword?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  eternalOnlineEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(60)
  @Max(3600)
  @IsOptional()
  onlineKeepAliveInterval?: number;
}

