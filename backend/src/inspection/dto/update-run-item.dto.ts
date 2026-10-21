import { Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator'

export enum InspectionRunItemStatusDto {
  PENDING = 'PENDING',
  OK = 'OK',
  ISSUE = 'ISSUE',
  CRITICAL = 'CRITICAL',
  SKIPPED = 'SKIPPED',
}

export class UpdateRunItemDto {
  @IsOptional()
  @IsEnum(InspectionRunItemStatusDto)
  status?: InspectionRunItemStatusDto

  @IsOptional()
  @IsBoolean()
  requiresRepair?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string

  @IsOptional()
  @IsBoolean()
  booleanValue?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numberValue?: number

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  textValue?: string
}
