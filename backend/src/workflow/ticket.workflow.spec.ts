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

  it('treats omitted opts as the parent table', () => {
    expect(
      decideTicketTransition(TicketStatus.IN_PROGRESS, TicketStatus.FIELD_COMPLETE),
    ).toEqual({
      allowed: false,
      reason: 'Invalid status transition: IN_PROGRESS -> FIELD_COMPLETE',
    });
    expect(
      decideTicketTransition(TicketStatus.IN_PROGRESS, TicketStatus.FIELD_COMPLETE, {
        isChild: false,
      }),
    ).toEqual({
      allowed: false,
      reason: 'Invalid status transition: IN_PROGRESS -> FIELD_COMPLETE',
    });
  });

  it('lets a child complete in the field and reopen, but not enter acceptance or DONE', () => {
    expect(
      decideTicketTransition(TicketStatus.NEW, TicketStatus.FIELD_COMPLETE, { isChild: true }),
    ).toEqual({ allowed: true });
    expect(
      decideTicketTransition(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, { isChild: true }),
    ).toEqual({ allowed: true });
    expect(
      decideTicketTransition(TicketStatus.IN_PROGRESS, TicketStatus.FIELD_COMPLETE, {
        isChild: true,
      }),
    ).toEqual({ allowed: true });
    expect(
      decideTicketTransition(TicketStatus.FIELD_COMPLETE, TicketStatus.IN_PROGRESS, {
        isChild: true,
      }),
    ).toEqual({ allowed: true });
    expect(
      decideTicketTransition(TicketStatus.FIELD_COMPLETE, TicketStatus.CANCELED, {
        isChild: true,
      }),
    ).toEqual({ allowed: true });
    expect(
      decideTicketTransition(TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_ACCEPTANCE, {
        isChild: true,
      }),
    ).toEqual({
      allowed: false,
      reason: 'Invalid status transition: IN_PROGRESS -> AWAITING_ACCEPTANCE',
    });
    expect(
      decideTicketTransition(TicketStatus.IN_PROGRESS, TicketStatus.DONE, { isChild: true }),
    ).toEqual({
      allowed: false,
      reason: 'Invalid status transition: IN_PROGRESS -> DONE',
    });
  });
});
