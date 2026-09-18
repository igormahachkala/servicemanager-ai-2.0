import { InspectionReportStatus, InspectionRunStatus } from '@prisma/client'
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * SMA-ROUND-RESULT-HISTORY-116F.
 *
 * Фильтры истории обходов берутся только из уже существующих измерений записи:
 * объект, исполнитель, шаблон, статус обхода, статус акта и окно по времени.
 * Новых доменных полей ради фильтра задача не заводит.
 *
 * Все они ложатся на существующие индексы InspectionRun: locationId+createdAt,
 * performedByUserId+createdAt, templateId+createdAt, reportStatus+createdAt,
 * companyId+status.
 */
export class ListRunsDto {
  /** Нижняя граница по времени начала обхода (createdAt), включительно. */
  @IsOptional()
  @IsDateString()
  from?: string

  /** Верхняя граница по времени начала обхода (createdAt), включительно. */
  @IsOptional()
  @IsDateString()
  to?: string

  @IsOptional()
  @IsUUID()
  locationId?: string

  @IsOptional()
  @IsUUID()
  performedByUserId?: string

  @IsOptional()
  @IsUUID()
  templateId?: string

  @IsOptional()
  @IsEnum(InspectionRunStatus)
  status?: InspectionRunStatus

  @IsOptional()
  @IsEnum(InspectionReportStatus)
  reportStatus?: InspectionReportStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}
