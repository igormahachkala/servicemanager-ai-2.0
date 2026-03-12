import { TicketStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export type BoardSlaBucket = 'breached' | 'atRisk' | 'ok';

function normalizeStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  if (Array.isArray(value)) {
    // status=NEW&status=ASSIGNED OR status=NEW,ASSIGNED in each element
    return value
      .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    // status=NEW,ASSIGNED
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return undefined;
}

export class BoardQueryDto {
  /**
   * Query param: status
   * Examples:
   * - status=NEW&status=ASSIGNED
   * - status=NEW,ASSIGNED
   */
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsEnum(TicketStatus, { each: true })
  status?: TicketStatus[];

  /**
   * Query param: assigneeId
   * - assigneeId=<uuid> => конкретный техник
   * - assigneeId=unassigned => только unassigned (mapped to null)
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return undefined;

    const v = value.trim();
    if (!v) return undefined;
    if (v === 'unassigned') return null;

    return v;
  })
  @IsUUID(undefined, { each: false })
  assigneeId?: string | null;

  /**
   * Query param: sla
   */
  @IsOptional()
  @IsEnum(['breached', 'atRisk', 'ok'] as const)
  sla?: BoardSlaBucket;

  /**
   * Query param: q
   */
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * Query param: take
   * Default handled in Policy (take ?? 500), but валидируем и ограничиваем.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}
