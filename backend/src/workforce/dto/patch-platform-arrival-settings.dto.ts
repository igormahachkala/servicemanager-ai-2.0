import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min } from 'class-validator'

export class PatchPlatformArrivalSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accuracyMeters?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  freshnessMinutes?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  radiusMeters?: number
}
