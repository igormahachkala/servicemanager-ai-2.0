import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus } from '@prisma/client';
import { ChildTicketResolutionItemDto } from './ticket-acceptance.dto';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildTicketResolutionItemDto)
  childResolutions?: ChildTicketResolutionItemDto[];
}
