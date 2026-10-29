import { Type } from 'class-transformer'
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator'

export class UpdateShiftGeoDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number

  @IsOptional()
  @IsDateString()
  capturedAt?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number
}
