import { TicketPriority, TicketUrgency } from '@prisma/client'
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  createMode?: 'quick' | 'full'

  @IsOptional()
  @IsUUID('all')
  parentId?: string | null

  @IsOptional()
  @IsUUID('all')
  clientCompanyId?: string

  @IsUUID('all')
  @IsNotEmpty()
  locationId!: string

  @IsOptional()
  @IsUUID('all')
  equipmentId?: string

  @IsOptional()
  @IsUUID('all')
  categoryId?: string

  @IsOptional()
  @IsUUID('all')
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
  @IsUUID('all', { each: true })
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
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  slaMinutes?: number
}
