import { TicketUrgency } from '@prisma/client'
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  createMode?: 'quick' | 'full'

  @IsOptional()
  @IsUUID()
  parentId?: string | null

  @IsOptional()
  @IsUUID()
  clientCompanyId?: string

  @IsUUID()
  @IsNotEmpty()
  locationId!: string

  @IsOptional()
  @IsUUID()
  equipmentId?: string

  @IsOptional()
  @IsUUID()
  categoryId?: string

  @IsOptional()
  @IsUUID()
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
  @IsUUID('4', { each: true })
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
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  slaMinutes?: number
}