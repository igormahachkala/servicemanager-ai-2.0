import { TicketStatus } from '@prisma/client'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export type BoardSlaBucket = 'breached' | 'atRisk' | 'ok'

function normalizeStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined

  if (Array.isArray(value)) {
    return value
      .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
      .map((s) => s.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  return undefined
}

export class BoardQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsEnum(TicketStatus, { each: true })
  status?: TicketStatus[]

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined
    if (typeof value !== 'string') return undefined

    const v = value.trim()
    if (!v) return undefined
    if (v === 'unassigned') return null

    return v
  })
  @IsUUID('all', { each: false })
  assigneeId?: string | null

  @IsOptional()
  @IsEnum(['breached', 'atRisk', 'ok'] as const)
  sla?: BoardSlaBucket

  @IsOptional()
  @IsString()
  q?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number

  @IsOptional()
  @IsUUID('all')
  linkedClientCompanyId?: string

  @IsOptional()
  @IsUUID('all')
  companyId?: string

  @IsOptional()
  @IsUUID('all')
  locationId?: string

  @IsOptional()
  @IsUUID('all')
  equipmentId?: string

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value === 'boolean') return value
    const normalized = String(value).trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
    return undefined
  })
  @IsBoolean()
  includeArchived?: boolean
}