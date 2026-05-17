import { TicketUrgency } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsUUID('all')
  problemCategoryId?: string;

  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @IsUUID('all')
  equipmentId?: string | null;

  @IsOptional()
  @IsString()
  problemText?: string;

  @IsOptional()
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency;

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

  @IsOptional()
  @IsString()
  comment?: string;
}
