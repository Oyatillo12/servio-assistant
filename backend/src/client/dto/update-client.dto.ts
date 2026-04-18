import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

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
}
