import { TicketPriority, TicketUrgency } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateChildTicketDto {
  @IsUUID('all')
  problemCategoryId!: string;

  @IsString()
  problemText!: string;

  @IsOptional()
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  slaMinutes?: number;
}
