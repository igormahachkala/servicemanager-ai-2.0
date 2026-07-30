import { TicketPriority, TicketUrgency } from '@prisma/client'
import { IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'

import { IsCanonicalUuid } from '../../common/validators/is-canonical-uuid.decorator'

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  createMode?: 'quick' | 'full'

  @IsOptional()
  @IsIn(['leave_unassigned', 'claim_self', 'assign_employee'])
  postCreateAction?: 'leave_unassigned' | 'claim_self' | 'assign_employee'

  @IsOptional()
  @IsCanonicalUuid()
  assignTechnicianId?: string | null

  @IsOptional()
  @IsCanonicalUuid()
  parentId?: string | null

  @IsOptional()
  @IsCanonicalUuid()
  clientCompanyId?: string

  @IsCanonicalUuid()
  @IsNotEmpty()
  locationId!: string

  @IsOptional()
  @IsCanonicalUuid()
  equipmentId?: string

  @IsOptional()
  @IsCanonicalUuid()
  categoryId?: string

  @IsOptional()
  @IsCanonicalUuid()
  problemCategoryId?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  problemText?: string

  @IsOptional()
  @IsString()
  comment?: string

  @IsOptional()
  @IsArray()
  @IsCanonicalUuid({ each: true })
  attachmentIds?: string[]

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
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority

  @IsOptional()
  @IsString()
  urgencyReason?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  slaMinutes?: number
}
