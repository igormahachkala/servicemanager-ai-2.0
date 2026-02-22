import { TicketUrgency } from '@prisma/client';

export class CreateTicketDto {
  parentId?: string | null;

  requesterName?: string;
  requesterPhone?: string;
  address?: string;
  pointName?: string;

  problemCategoryId: string;
  problemText: string;

  urgency?: TicketUrgency; // URGENT | NOT_URGENT
  slaMinutes?: number;
}
