import { TicketStatus } from '@prisma/client';

import {
  formatTicketCard,
  isActiveTicket,
  pageSlice,
  sortOldestFirst,
  statusLabel,
} from './max-chat-format';

describe('max-chat-format', () => {
  it('renders a short ticket card without requester fields', () => {
    const card = formatTicketCard({
      ticketNumber: 421,
      status: TicketStatus.ASSIGNED,
      location: { name: 'Фудзияма — Ленина' },
      problemText: 'Не работает холодильник. Температура +12 °C.',
    });
    expect(card).toContain('№421 · Назначена');
    expect(card).toContain('Фудзияма — Ленина');
    expect(card).not.toContain('Заявитель');
    expect(card).not.toContain('Телефон');
  });

  it('keeps assigned active tickets and pages five at a time, oldest first', () => {
    const rows = [
      { ticketNumber: 2, status: TicketStatus.ASSIGNED, assignedTechnicianId: 'me', createdAt: '2026-09-16T10:00:00Z' },
      { ticketNumber: 1, status: TicketStatus.IN_PROGRESS, assignedTechnicianId: 'me', createdAt: '2026-09-15T10:00:00Z' },
      { ticketNumber: 9, status: TicketStatus.NEW, assignedTechnicianId: null, createdAt: '2026-09-14T10:00:00Z' },
      { ticketNumber: 8, status: TicketStatus.DONE, assignedTechnicianId: 'me', createdAt: '2026-09-13T10:00:00Z' },
    ];
    const mine = sortOldestFirst(rows.filter((row) => isActiveTicket(row, 'me')));
    expect(mine.map((row) => row.ticketNumber)).toEqual([1, 2]);
    expect(statusLabel(TicketStatus.IN_PROGRESS)).toBe('В работе');
    const page = pageSlice([1, 2, 3, 4, 5, 6], 0);
    expect(page.slice).toEqual([1, 2, 3, 4, 5]);
    expect(page.nextOffset).toBe(5);
  });
});
