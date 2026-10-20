import { TicketUrgency } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator'

import { IsCanonicalUuid } from '../../common/validators/is-canonical-uuid.decorator'

export class UpdateTicketDto {
  @IsOptional()
  @IsCanonicalUuid()
  problemCategoryId?: string

  @IsOptional()
  @IsCanonicalUuid()
  locationId?: string

  @IsOptional()
  @IsCanonicalUuid()
  equipmentId?: string | null

  @IsOptional()
  @IsString()
  problemText?: string

  @IsOptional()
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency

  @IsOptional()
  @IsString()
  urgencyReason?: string

  @IsOptional()
  @IsString()
  requesterName?: string

  @IsOptional()
  @IsString()
  requesterPhone?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  pointName?: string

  // Очистка срока: пустая строка и null означают «срока нет». @IsOptional
  // пропускает только null/undefined, поэтому пустую строку исключаем явно,
  // иначе @IsDateString отверг бы очистку срока ошибкой 400.
  @IsOptional()
  @ValidateIf((o) => o.plannedDueAt !== null && o.plannedDueAt !== '')
  @IsDateString()
  plannedDueAt?: string | null

  @IsOptional()
  @IsString()
  comment?: string
}
