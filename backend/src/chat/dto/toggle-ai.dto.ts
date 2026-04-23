import { IsBoolean } from 'class-validator';

export class ToggleAiDto {
  @IsBoolean()
  isAiActive: boolean;
}
