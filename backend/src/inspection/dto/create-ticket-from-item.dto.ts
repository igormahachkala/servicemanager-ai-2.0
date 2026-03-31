import { IsString, IsUUID, MaxLength, IsOptional, IsEnum } from 'class-validator'
import { TicketUrgency } from '@prisma/client'

export class CreateTicketFromItemDto {
  @IsUUID()
  categoryId!: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @IsOptional()
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency
}
