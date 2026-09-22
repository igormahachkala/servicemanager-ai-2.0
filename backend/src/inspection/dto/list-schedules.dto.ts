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

  /**
   * SMA-ROUND-SCHEDULE-ADVANCE-029.
   *
   * Канонический признак «план на сегодня». Границу считает сервер в поясе
   * компании, поэтому /m и MAX спрашивают одно и то же и получают один ответ.
   *
   * Просроченные активные планы входят в выдачу намеренно: нижней границы нет.
   * Визит, который не сделали вчера, обязан остаться на виду, иначе он не
   * будет сделан никогда. Раньше так вёл себя MAX, а /m такие планы прятал.
   */
  @IsOptional()
  @IsBooleanString()
  dueToday?: string
}
