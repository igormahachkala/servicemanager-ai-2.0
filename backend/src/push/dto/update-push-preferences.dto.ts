import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * PATCH /push/preferences — частичное обновление тумблеров категорий (+ тихие часы).
 * Все поля опциональны; @IsOptional пропускает и undefined, и null (сброс тихих часов).
 * Совпадает с PushPreference на фронте (web/src/lib/api.ts).
 */
export class UpdatePushPreferencesDto {
  @IsOptional()
  @IsBoolean()
  chat?: boolean;

  @IsOptional()
  @IsBoolean()
  ticketNew?: boolean;

  @IsOptional()
  @IsBoolean()
  assignment?: boolean;

  @IsOptional()
  @IsBoolean()
  statusChange?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptance?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptanceReject?: boolean;

  @IsOptional()
  @IsBoolean()
  sla?: boolean;

  @IsOptional()
  @IsBoolean()
  news?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursFrom?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursTo?: number | null;
}
