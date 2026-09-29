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
  it('unassigned page has open, assign and Меню, without the section footer', () => {
    const page = toMasterTicketListPage('Без исполнителя', 'unassigned', [item(1), item(2), item(3)], 0);
    expect(page.items).toHaveLength(1);
    const res = renderMasterTicketListMessage(page);
    expect(res.attachments?.[0]?.payload.buttons.flat().map((button) => button.text)).toEqual([
      '#1',
      'Назначить #1',
      'Следующие',
      'Меню',
    ]);
  });

  it('filter lists keep up to six opens with Меню and Отмена on one row', () => {
    const page = toMasterTicketListPage(
      'Новые',
      'new',
      [item(1), item(2), item(3), item(4), item(5), item(6), item(7)],
      0,
    );
    expect(page.items).toHaveLength(6);
    const res = renderMasterTicketListMessage(page);
    expect(res.attachments?.[0]?.payload.buttons.flat().map((button) => button.text)).toEqual([
      '#1',
      '#2',
      '#3',
      '#4',
      '#5',
      '#6',
      'Следующие',
      'Меню',
      'Отмена',
    ]);
    const footer = res.attachments?.[0]?.payload.buttons.at(-1)?.map((button) => button.text);
    expect(footer).toEqual(['Меню', 'Отмена']);
  });

  it('card uses dedicated rows, optional Назад, and Меню', () => {
    const res = renderMasterTicketCardMessage(
      {
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
      },
      'ml:new:0',
    );
    expect(res.attachments?.[0]?.payload.buttons.map((row) => row.map((button) => button.text))).toEqual([
      ['Назначить', 'Упомянуть'],
      ['Комментарий'],
      ['Вложения', 'История'],
      ['Обход'],
      ['Назад'],
      ['Меню'],
    ]);
    expect(res.attachments?.[0]?.payload.buttons[4]).toEqual([
      { type: 'callback', text: 'Назад', payload: 'ml:new:0' },
    ]);
  });
});
