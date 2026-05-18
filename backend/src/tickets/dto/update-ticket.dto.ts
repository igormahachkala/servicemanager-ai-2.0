import { TicketUrgency } from '@prisma/client'
import { IsEnum, IsOptional, IsString } from 'class-validator'

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

  @IsOptional()
  @IsString()
  comment?: string
}
