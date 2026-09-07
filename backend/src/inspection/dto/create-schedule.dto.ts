import { InspectionFrequency } from '@prisma/client'
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

/**
 * SMA-ROUNDS-V1-SCHEDULE-CRUD-098.
 *
 * Field names and optionality mirror CreateInspectionScheduleInput, which already exists in
 * web/src/lib/api.ts and has been waiting for a backend. Renaming anything here would mean
 * rewriting a client contract that is already correct.
 */
export class CreateScheduleDto {
  @IsUUID()
  templateId!: string

  @IsUUID()
  locationId!: string

  @IsOptional()
  @IsUUID()
  equipmentId?: string

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string

  @IsEnum(InspectionFrequency)
  frequency!: InspectionFrequency

  /** Only meaningful for CUSTOM. The service rejects it on every other frequency. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  intervalDays?: number

  /** Planned date AND time of the round — DateTime, so no separate time column is needed. */
  @IsDateString()
  startDate!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
