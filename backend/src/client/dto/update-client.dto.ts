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

  /** Set to a token string to use a dedicated bot, or empty/null to fall back to the general bot. */
  @IsString()
  @IsOptional()
  botToken?: string | null;

  @IsIn(['gemini', 'openai'])
  @IsOptional()
  aiProvider?: 'gemini' | 'openai';

  @IsString()
  @IsOptional()
  aiModel?: string | null;
}
