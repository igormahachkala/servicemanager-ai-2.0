import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

/**
 * SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B.
 *
 * At least one corrected value must be present — enforced in the service, where the shift is
 * also available, rather than by a validator that could only see the DTO in isolation.
 */
export class CreateShiftCorrectionDto {
  @IsOptional()
  @IsDateString()
  correctedOpenedAt?: string

  @IsOptional()
  @IsDateString()
  correctedClosedAt?: string

  /** Required and non-blank: a correction nobody can explain later is not an audit record. */
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string
}
