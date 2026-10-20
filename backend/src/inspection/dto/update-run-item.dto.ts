import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

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
}
