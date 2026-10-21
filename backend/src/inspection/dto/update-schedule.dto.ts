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
  ValidateIf,
} from 'class-validator'

/**
 * SMA-ROUNDS-V1-SCHEDULE-CRUD-098.
 *
 * Mirrors UpdateInspectionScheduleInput in web/src/lib/api.ts: every field optional, and the
 * nullable ones explicitly nullable so a manager can clear an assignee or an equipment link
 * without deleting the schedule.
 */
export class UpdateScheduleDto {
  @IsOptional()
  @IsUUID()
  templateId?: string

  @IsOptional()
  @IsUUID()
  locationId?: string

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  equipmentId?: string | null

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  assignedToUserId?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string

  @IsOptional()
  @IsEnum(InspectionFrequency)
  frequency?: InspectionFrequency

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(3650)
  intervalDays?: number | null

  @IsOptional()
  @IsDateString()
  startDate?: string

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
