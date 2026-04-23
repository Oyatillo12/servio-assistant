import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LeadStatus } from '../entities/lead-status.enum.js';

export class BantMetadataDto {
  @IsString()
  @IsOptional()
  budget?: string;

  @IsEnum(['decision_maker', 'influencer', 'user', 'unknown'])
  @IsOptional()
  authority?: 'decision_maker' | 'influencer' | 'user' | 'unknown';

  @IsString()
  @IsOptional()
  need?: string;

  @IsString()
  @IsOptional()
  timeline?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateLeadDto {
  /** Lead score, 0–100 by convention. */
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  score?: number;

  @IsEnum(LeadStatus)
  @IsOptional()
  leadStatus?: LeadStatus;

  /** Toggle AI ↔ Manual handoff. */
  @IsBoolean()
  @IsOptional()
  isAiActive?: boolean;

  /**
   * Partial BANT patch — only the keys you pass are merged into the existing
   * `metadata` jsonb column; existing keys not present here are preserved.
   */
  @ValidateNested()
  @Type(() => BantMetadataDto)
  @IsOptional()
  metadata?: BantMetadataDto;
}
