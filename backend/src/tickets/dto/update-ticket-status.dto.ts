import { TicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  status: TicketStatus;
  comment?: string;
}
