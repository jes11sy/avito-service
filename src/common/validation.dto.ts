import { IsString, IsNotEmpty, Matches, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Safe ID parameter validation
 * Prevents SQL injection through ID parameters
 */
export class IdParamDto {
  @ApiProperty({ description: 'Numeric ID' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  id: number;
}

/**
 * Safe Chat ID validation
 * Chat IDs from Avito are alphanumeric with hyphens
 */
export class ChatIdDto {
  @ApiProperty({ description: 'Chat ID from Avito' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Chat ID must contain only alphanumeric characters, underscores, and hyphens',
  })
  chatId: string;
}

/**
 * Safe account name validation
 * Account names should be clean strings
 */
export class AccountNameDto {
  @ApiProperty({ description: 'Avito account name' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9А-Яа-я\s_-]+$/, {
    message: 'Account name contains invalid characters',
  })
  avitoAccountName: string;
}

/**
 * Safe phone number validation
 */
export class PhoneDto {
  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'Invalid phone number format',
  })
  phone: string;
}

/**
 * Pagination validation
 */
export class PaginationDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

/**
 * Safe message ID validation
 */
export class MessageIdDto {
  @ApiProperty({ description: 'Message ID from Avito' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Message ID must contain only alphanumeric characters, underscores, and hyphens',
  })
  messageId: string;
}

/**
 * Safe user ID validation
 */
export class UserIdDto {
  @ApiProperty({ description: 'Avito user ID' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]+$/, {
    message: 'User ID must be numeric',
  })
  userId: string;
}

/**
 * Query filters validation
 */
export class FilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9А-Яа-я\s_-]*$/, {
    message: 'Filter contains invalid characters',
  })
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+$/, {
    message: 'Invalid sort field',
  })
  sortBy?: string;

  @ApiProperty({ required: false, enum: ['asc', 'desc'] })
  @IsOptional()
  @Matches(/^(asc|desc)$/, {
    message: 'Sort order must be asc or desc',
  })
  sortOrder?: 'asc' | 'desc';
}

