import { InspectionFrequency } from '@prisma/client'
import { IsBooleanString, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator'

/**
 * SMA-ROUNDS-V1-SCHEDULE-CRUD-098.
 *
 * Only the filters the planning workflow actually needs: pick a technician, a site, a window,
 * a repetition, or hide retired plans. Anything beyond that would be analytics, which 098 is
 * explicitly not. Values arrive as query strings, hence IsBooleanString for `active`.
 */
export class ListSchedulesDto {
  /** Inclusive lower bound on nextDueAt. */
  @IsOptional()
  @IsDateString()
  from?: string

  /** Inclusive upper bound on nextDueAt. */
  @IsOptional()
  @IsDateString()
  to?: string

  @IsOptional()
  @IsUUID()
  locationId?: string

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string

  @IsOptional()
  @IsEnum(InspectionFrequency)
  frequency?: InspectionFrequency

  @IsOptional()
  @IsBooleanString()
  active?: string
}
