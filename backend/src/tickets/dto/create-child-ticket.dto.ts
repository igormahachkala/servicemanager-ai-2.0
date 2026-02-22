import { TicketUrgency } from '@prisma/client';

export class CreateChildTicketDto {
  problemCategoryId: string;
  problemText: string;
  urgency?: TicketUrgency;
  slaMinutes?: number;
}
