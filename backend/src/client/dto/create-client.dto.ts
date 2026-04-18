import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ClientAdminCredentials {
  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  hasProducts?: boolean;

  @IsBoolean()
  @IsOptional()
  hasServices?: boolean;

  @IsIn(['order', 'lead'])
  @IsOptional()
  type?: 'order' | 'lead';

  @IsIn(['uz', 'ru', 'en'])
  @IsOptional()
  defaultLang?: 'uz' | 'ru' | 'en';

  @IsIn(['UZS', 'USD', 'RUB'])
  @IsOptional()
  currency?: 'UZS' | 'USD' | 'RUB';

  @IsNumber()
  @IsOptional()
  adminChatId?: number;

  @IsObject()
  @IsOptional()
  botConfig?: Record<string, unknown>;

  /** When provided, a client_admin user is created with these credentials */
  @ValidateNested()
  @Type(() => ClientAdminCredentials)
  @IsOptional()
  adminCredentials?: ClientAdminCredentials;
}
