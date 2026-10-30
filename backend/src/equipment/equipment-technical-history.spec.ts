import { TicketStatus } from '@prisma/client';

import { buildEquipmentHistory } from './equipment-history.model';

const at = new Date('2026-09-01T08:00:00.000Z');
const resultAt = new Date('2026-09-02T09:00:00.000Z');

function source(overrides = {}) {
  return {
    id: 'request-1', createdAt: at, problemText: 'Не охлаждает',
    statusHistory: [{ toStatus: TicketStatus.AWAITING_ACCEPTANCE, comment: 'Промыт теплообменник', createdAt: resultAt, changedBy: { email: 'hidden@example.invalid' } }],
    ticketNumber: 123, status: TicketStatus.DONE, closedAt: resultAt,
    assignedTechnician: { id: 'hidden-person', email: 'hidden@example.invalid', company: { name: 'hidden-company' } },
    attachments: [{ url: '/hidden-file', originalName: 'hidden.pdf', mimeType: 'application/pdf' }],
    comments: [{ text: 'hidden-chat', author: { email: 'hidden@example.invalid' } }],
    notes: 'hidden-note', parent: { id: 'hidden-parent' }, children: [{ id: 'hidden-child' }],
    ...overrides,
  };
}

describe('Equipment technical history allowlist', () => {
  it('projects only agreed technical fields, including nested parts, even if sources carry extra metadata', () => {
    const result = buildEquipmentHistory([source()], [{
      id: 'hidden-part-id', displayName: 'Датчик', serialNumber: 'S-1', quantity: 2,
      installedTicketId: 'request-1', removedTicketId: 'hidden-request',
      installedBy: { email: 'hidden@example.invalid' }, removedBy: { id: 'hidden-user' },
      comment: 'hidden-part-note', removalComment: 'hidden-removal-note', attachments: [{ url: '/hidden-file' }],
    } as any]);
    expect(result).toEqual([{
      ticketId: 'request-1', createdAt: at, problem: 'Не охлаждает',
      result: 'Промыт теплообменник', resultAt, workReports: [],
      partsInstalled: [{ name: 'Датчик', serialNumber: 'S-1', quantity: '2' }], partsRemoved: [],
    }]);
    // Assert recursively, not just that the UI hides the old fields.
    expect(JSON.stringify(result)).not.toContain('hidden');
  });

  it('keeps the old unconditional workReports.length read safe without exposing source files', () => {
    const [entry] = buildEquipmentHistory([source({
      workReports: [{ url: '/hidden-report', originalName: 'hidden-report.pdf' }],
    })]);
    // Emulate the old desktop consumer after the JSON transport boundary.
    const legacyEntry = JSON.parse(JSON.stringify(entry));
    expect(() => legacyEntry.workReports.length).not.toThrow();
    expect(legacyEntry.workReports.length).toBe(0);
    expect(legacyEntry.workReports).toEqual([]);
    expect(JSON.stringify(legacyEntry)).not.toContain('hidden');
  });

  it('does not infer completed work from an open request or its problem description', () => {
    const [entry] = buildEquipmentHistory([source({
      status: TicketStatus.NEW, problemText: 'Нужно заменить датчик', statusHistory: [],
    })]);
    expect(entry).toEqual({
      ticketId: 'request-1', createdAt: at, problem: 'Нужно заменить датчик',
      result: null, resultAt: null, workReports: [], partsInstalled: [], partsRemoved: [],
    });
  });

  it('does not treat unrelated status notes/chat as work results', () => {
    const [entry] = buildEquipmentHistory([source({
      statusHistory: [{ toStatus: TicketStatus.IN_PROGRESS, comment: 'hidden-chat', createdAt: resultAt }],
    })]);
    expect(entry.result).toBeNull();
    expect(entry.resultAt).toBeNull();
    expect(JSON.stringify(entry)).not.toContain('hidden');
  });

  it('preserves entered technical text without claiming automatic personal-data redaction', () => {
    const text = 'Проверка <script>не исполнять</script>; контакт test@example.invalid';
    const [entry] = buildEquipmentHistory([source({
      problemText: text,
      statusHistory: [{ toStatus: TicketStatus.DONE, comment: text, createdAt: resultAt }],
    })]);
    expect(entry.problem).toBe(text);
    expect(entry.result).toBe(text);
  });
});
