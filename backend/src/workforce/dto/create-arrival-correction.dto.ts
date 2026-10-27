import { IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator'

function isPresentDate(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

/**
 * Пустое время значит, что этого факта не было. Обе пустые отметки допустимы.
 * Минимальную длину причины в 3 символа от правки смены не копируем.
 */
export class CreateArrivalCorrectionDto {
  @IsOptional()
  @ValidateIf((_, value) => isPresentDate(value))
  @IsDateString()
  correctedArrivedAt?: string | null

  @IsOptional()
  @ValidateIf((_, value) => isPresentDate(value))
  @IsDateString()
  correctedDepartedAt?: string | null

  @IsString()
  @MaxLength(500)
  reason!: string
}
