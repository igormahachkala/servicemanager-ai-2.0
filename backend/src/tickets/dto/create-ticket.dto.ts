import { TicketUrgency } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  requesterName?: string;

  @IsOptional()
  @IsString()
  requesterPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  pointName?: string;

  @IsUUID()
  problemCategoryId!: string;

  @IsString()
  problemText!: string;

  @IsOptional()
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  slaMinutes?: number;
}
