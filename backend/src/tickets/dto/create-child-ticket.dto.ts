import { TicketPriority, TicketUrgency } from '@prisma/client'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

import { IsCanonicalUuid } from '../../common/validators/is-canonical-uuid.decorator'

export class CreateChildTicketDto {
  @IsCanonicalUuid()
  problemCategoryId!: string

  @IsString()
  problemText!: string

  @IsOptional()
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  slaMinutes?: number
}
