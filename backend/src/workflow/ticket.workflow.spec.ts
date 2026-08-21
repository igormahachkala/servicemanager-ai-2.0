import { TicketStatus } from '@prisma/client';

import { decideTicketTransition } from './ticket.workflow';

describe('decideTicketTransition', () => {
  it('does not allow acceptance-stage ticket to become DONE through generic workflow', () => {
    expect(
      decideTicketTransition(TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE),
    ).toEqual({
      allowed: false,
      reason: 'Invalid status transition: AWAITING_ACCEPTANCE -> DONE',
    });
  });

  it('keeps provider completion and client rework transitions valid', () => {
    expect(
      decideTicketTransition(
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_ACCEPTANCE,
      ),
    ).toEqual({ allowed: true });
    expect(
      decideTicketTransition(
        TicketStatus.AWAITING_ACCEPTANCE,
        TicketStatus.IN_PROGRESS,
      ),
    ).toEqual({ allowed: true });
  });
});
