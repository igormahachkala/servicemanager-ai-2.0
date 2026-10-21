import { toMasterTicketListPage, renderMasterTicketListMessage, renderMasterTicketCardMessage } from './max-master-tickets';

const item = (n: number) => ({
  id: `11111111-1111-4111-8111-11111111111${n}`,
  ticketNumber: n,
  locationName: 'Склад',
  problemText: 'Не морозит',
  urgencyLabel: 'Срочно',
  statusLabel: 'Новая',
  assigneeName: 'Не назначен',
  categoryName: 'Холод',
  createdLabel: '09:00',
  slaLabel: null,
});

function buttonCount(response: ReturnType<typeof renderMasterTicketListMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat().length || 0;
}

describe('master ticket screens stay within the MAX button cap', () => {
  it('unassigned/sla pages show one card so open+assign+footer fit in 7', () => {
    const page = toMasterTicketListPage('Без исполнителя', 'unassigned', [item(1), item(2), item(3)], 0);
    expect(page.items).toHaveLength(1);
    expect(buttonCount(renderMasterTicketListMessage(page))).toBeLessThanOrEqual(7);
  });

  it('filter lists keep three opens plus footer', () => {
    const page = toMasterTicketListPage('Новые', 'new', [item(1), item(2), item(3), item(4)], 0);
    expect(page.items).toHaveLength(3);
    expect(buttonCount(renderMasterTicketListMessage(page))).toBeLessThanOrEqual(7);
  });

  it('card uses Меню instead of the three-button footer', () => {
    const res = renderMasterTicketCardMessage({
      id: '11111111-1111-4111-8111-111111111111',
      ticketNumber: 12,
      locationName: 'Склад',
      equipmentName: 'Шкаф',
      sourceLabel: 'обход Утро',
      sourceRunId: '22222222-2222-4222-8222-222222222222',
      attachmentCount: 1,
      historyPreview: '',
      canAssign: true,
      hasAssignee: false,
    });
    expect(buttonCount(res)).toBeLessThanOrEqual(7);
    expect(res.attachments?.[0]?.payload.buttons.flat().map((button) => button.text)).toContain('Меню');
  });
});
