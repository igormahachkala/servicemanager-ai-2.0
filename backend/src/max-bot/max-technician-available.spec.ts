import { TicketStatus } from '@prisma/client';

import {
  renderAvailableClaimedMessage,
  renderAvailableTakenMessage,
  renderAvailableTicketsMessage,
  toTechnicianAvailablePage,
} from './max-technician-available';
import { renderTechnicianTicketCardMessage, toTechnicianTicketCardView } from './max-technician-tickets';

const ID = '11111111-1111-4111-8111-111111111111';

function labelsOf(response: ReturnType<typeof renderAvailableTicketsMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-technician-available', () => {
  it('pages available tickets and keeps claim/details buttons', () => {
    const page = toTechnicianAvailablePage(
      [
        {
          id: ID,
          ticketNumber: 12,
          status: TicketStatus.NEW,
          urgency: 'URGENT',
          problemText: 'Не морозит',
          requesterPhone: '79990001122',
          location: { name: 'Склад' },
          canClaim: true,
        },
      ],
      0,
    );
    expect(page.items).toEqual([
      {
        id: ID,
        ticketNumber: 12,
        locationName: 'Склад',
        problemText: 'Не морозит',
        urgencyLabel: 'Срочно',
        statusLabel: 'Новая',
        canClaim: true,
      },
    ]);
    const res = renderAvailableTicketsMessage(page);
    expect(res.text).toContain('Доступные');
    expect(res.text).not.toContain('7999');
    expect(labelsOf(res)).toEqual(['Взять #12', 'Подробнее', 'Меню']);
  });

  it('hides claim when the kernel did not allow it', () => {
    const res = renderAvailableTicketsMessage(
      toTechnicianAvailablePage(
        [
          {
            id: ID,
            ticketNumber: 9,
            status: TicketStatus.NEW,
            problemText: 'Капает',
            location: { name: 'Кухня' },
            canClaim: false,
            canRequestAssignment: true,
          },
        ],
        0,
      ),
    );
    expect(labelsOf(res)).toEqual(['Подробнее', 'Меню']);
  });

  it('prefixes claimed card and taken list', () => {
    const card = toTechnicianTicketCardView({
      id: ID,
      ticketNumber: 12,
      status: TicketStatus.ASSIGNED,
      problemText: 'Не морозит',
      location: { name: 'Склад' },
      meta: { availableActions: { canStart: true, canComplete: false }, availableStatusTransitions: [] },
    });
    const claimed = renderAvailableClaimedMessage(card!, renderTechnicianTicketCardMessage(card!));
    expect(claimed.text).toContain('Заявка #12 назначена вам.');
    expect(claimed.text).toContain('Заявка #12');

    const taken = renderAvailableTakenMessage({ items: [], prevOffset: null, nextOffset: null });
    expect(taken.text).toContain('Заявку уже взяли.');
    expect(taken.text).toContain('Нет доступных заявок.');
  });
});
