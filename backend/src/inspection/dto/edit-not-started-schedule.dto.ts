import { InspectionFrequency } from '@prisma/client'
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'

/** A complete editor snapshot, not a replacement for the legacy schedule PATCH. */
export class EditNotStartedScheduleDto {
  @IsUUID()
  templateId!: string

  @IsUUID()
  locationId!: string

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  equipmentId?: string | null

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  assignedToUserId?: string | null

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string

  @IsEnum(InspectionFrequency)
  frequency!: InspectionFrequency

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(3650)
  intervalDays?: number | null

  @IsDateString({ strict: true })
  startDate!: string

  /** Revision displayed when the editor opened; stale drafts must never overwrite a plan. */
  @IsDateString({ strict: true })
  expectedUpdatedAt!: string
}
