import { TicketStatus } from '@prisma/client';

import {
  parseTechnicianTicketAction,
  renderCommentPromptMessage,
  renderCommentSavedMessage,
  renderTechnicianTicketCardMessage,
  renderTechnicianTicketsListMessage,
  renderTicketActionStubMessage,
  renderTicketHistoryMessage,
  renderTicketStatusPickerMessage,
  toTechnicianTicketCardView,
  toTechnicianTicketHistoryPage,
  toTechnicianTicketListItem,
  type TechnicianTicketListItem,
} from './max-technician-tickets';

const ID_OLD = '11111111-1111-4111-8111-111111111111';
const ID_NEW = '22222222-2222-4222-8222-222222222222';

function buttonsOf(response: ReturnType<typeof renderTechnicianTicketsListMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat() || [];
}

function listItem(overrides: Partial<TechnicianTicketListItem> = {}): TechnicianTicketListItem {
  return {
    id: ID_OLD,
    ticketNumber: 12,
    locationName: 'Склад',
    problemText: 'Не морозит',
    urgencyLabel: 'Срочно',
    statusLabel: 'Назначена',
    ...overrides,
  };
}

describe('max-technician-tickets', () => {
  it('maps a short card without requester or technician phones', () => {
    const item = toTechnicianTicketListItem({
      id: ID_OLD,
      ticketNumber: 12,
      status: TicketStatus.ASSIGNED,
      urgency: 'URGENT',
      problemText: 'Не работает холодильник. Температура +12 °C.',
      requesterPhone: '79990001122',
      location: { name: 'Фудзияма — Ленина' },
      assignedTechnician: { firstName: 'Иван', phone: '70001112233' },
      createdByUser: { firstName: 'Клиент', phone: '71112223344' },
    });
    expect(item).toEqual({
      id: ID_OLD,
      ticketNumber: 12,
      locationName: 'Фудзияма — Ленина',
      problemText: 'Не работает холодильник. Температура +12 °C.',
      urgencyLabel: 'Срочно',
      statusLabel: 'Назначена',
    });
    expect(JSON.stringify(item)).not.toContain('7999');
    expect(JSON.stringify(item)).not.toContain('7000');
  });

  it('renders six cards as #{id}, Next on its own row, and Menu last', () => {
    const items = [1, 2, 3, 4, 5, 6].map((n) =>
      listItem({
        id: `${n}1111111-1111-4111-8111-111111111111`,
        ticketNumber: 10 + n,
      }),
    );
    const res = renderTechnicianTicketsListMessage({ items, prevOffset: null, nextOffset: 6 });
    expect(res.text).toContain('#11 · Назначена · Срочно');
    expect(res.text).toContain('Склад');
    expect(res.text).not.toContain('Телефон');
    const rows = res.attachments?.[0]?.payload.buttons || [];
    const labels = buttonsOf(res).map((button) => button.text);
    expect(labels).toEqual(['#11', '#12', '#13', '#14', '#15', '#16', 'Следующие', 'Меню']);
    expect(rows[2]).toEqual([{ type: 'callback', text: 'Следующие', payload: 'my:6' }]);
    expect(rows[rows.length - 1]).toEqual([{ type: 'callback', text: 'Меню', payload: 'menu' }]);
    expect(buttonsOf(res).every((button) => button.type === 'callback')).toBe(true);
  });

  it('shows Previous on a later page and drops Next on the last page', () => {
    const res = renderTechnicianTicketsListMessage({
      items: [listItem({ ticketNumber: 8 })],
      prevOffset: 0,
      nextOffset: null,
    });
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['#8', 'Предыдущие', 'Меню']);
    expect(rows[1]).toEqual([{ type: 'callback', text: 'Предыдущие', payload: 'my:0' }]);
  });

  it('says the list is empty without inventing tickets', () => {
    const res = renderTechnicianTicketsListMessage({ items: [], prevOffset: null, nextOffset: null });
    expect(res.text).toContain('Нет назначенных заявок');
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Меню']);
  });

  it('draws card fields and kernel buttons in the first_wave order', () => {
    const card = toTechnicianTicketCardView({
      id: ID_NEW,
      ticketNumber: 90,
      status: TicketStatus.ASSIGNED,
      urgency: 'NOT_URGENT',
      problemText: 'Капает кран',
      requesterPhone: '79990001122',
      location: { name: 'Кухня' },
      problemCategory: { name: 'Сантехника' },
      equipment: { name: 'Смеситель' },
      assignedTechnician: { firstName: 'Виктор', lastName: 'Иванов', phone: '70001112233' },
      meta: {
        availableActions: {
          canStart: true,
          canComplete: false,
          canAccept: true,
          canReject: true,
          canClaim: true,
        },
        availableStatusTransitions: [TicketStatus.IN_PROGRESS],
      },
    });
    expect(card?.assigneeName).toBe('Виктор Иванов');
    expect(JSON.stringify(card)).not.toContain('7999');
    const res = renderTechnicianTicketCardMessage(card!);
    expect(res.text).toContain('Заявка #90');
    expect(res.text).toContain('Объект: Кухня');
    expect(res.text).toContain('Категория: Сантехника');
    expect(res.text).toContain('Проблема: Капает кран');
    expect(res.text).toContain('Срочность: Не срочно');
    expect(res.text).toContain('Статус: Назначена');
    expect(res.text).toContain('Исполнитель: Виктор Иванов');
    expect(res.text).toContain('Оборудование: Смеситель');
    expect(res.text).not.toContain('Телефон');
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(rows.map((row) => row.map((button) => button.text))).toEqual([
      ['Начать работу', 'Комментарий'],
      ['Фото', 'История'],
      ['Меню'],
    ]);
    expect(buttonsOf(res).map((button) => button.text).join()).not.toMatch(/Принять|Отклонить|Взять|Изменить статус/);
  });

  it('parses list paging and ticket ids, rejects junk', () => {
    expect(parseTechnicianTicketAction('my:5')).toEqual({ kind: 'list', offset: 5 });
    expect(parseTechnicianTicketAction(`tk:${ID_OLD}`)).toEqual({ kind: 'card', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tks:${ID_OLD}`)).toEqual({ kind: 'start', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tkm:${ID_OLD}`)).toEqual({ kind: 'status', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tkp:${ID_OLD}:ASSIGNED`)).toEqual({
      kind: 'apply',
      ticketId: ID_OLD,
      status: TicketStatus.ASSIGNED,
    });
    expect(parseTechnicianTicketAction(`tkh:${ID_OLD}`)).toEqual({ kind: 'history', ticketId: ID_OLD, offset: 0 });
    expect(parseTechnicianTicketAction(`tkh:${ID_OLD}:5`)).toEqual({ kind: 'history', ticketId: ID_OLD, offset: 5 });
    expect(parseTechnicianTicketAction(`tkc:${ID_OLD}`)).toEqual({ kind: 'comment', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tkf:${ID_OLD}`)).toEqual({ kind: 'photo', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tku:${ID_OLD}`)).toEqual({ kind: 'complete', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tkq:${ID_OLD}`)).toEqual({ kind: 'completePhoto', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tky:${ID_OLD}`)).toEqual({ kind: 'completeAsk', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction(`tkz:${ID_OLD}`)).toEqual({ kind: 'completeSkip', ticketId: ID_OLD });
    expect(parseTechnicianTicketAction('tk:not-an-id')).toBeNull();
    expect(parseTechnicianTicketAction('claim_ticket_123')).toBeNull();
  });

  it('stub keeps a way back to the card', () => {
    const res = renderTicketActionStubMessage(ID_OLD);
    expect(res.text).toBe('Этот функционал в разработке');
    expect(buttonsOf(res)[0]).toEqual({ type: 'callback', text: 'К заявке', payload: `tk:${ID_OLD}` });
  });

  it('status picker lists leftover transitions and cancel, history hides phones', () => {
    const card = toTechnicianTicketCardView({
      id: ID_OLD,
      ticketNumber: 12,
      status: TicketStatus.IN_PROGRESS,
      problemText: 'Капает',
      location: { name: 'Кухня' },
      assignedTechnician: { firstName: 'Виктор', phone: '70001112233' },
      meta: {
        availableActions: { canStart: false, canComplete: true },
        availableStatusTransitions: [TicketStatus.ASSIGNED, TicketStatus.DONE, TicketStatus.CANCELED],
      },
    });
    expect(card?.pickerTransitions).toEqual([TicketStatus.ASSIGNED]);
    const picker = renderTicketStatusPickerMessage(card!);
    expect(picker.text).toContain('Выберите действие');
    expect(buttonsOf(picker).map((button) => button.text)).toEqual(['Назначена', 'Отмена', 'Меню']);

    const history = renderTicketHistoryMessage(
      toTechnicianTicketHistoryPage(
        ID_OLD,
        12,
        [
          {
            at: '2026-09-18T10:00:00Z',
            timelineEvent: 'STATUS_CHANGED',
            payload: { fromStatus: TicketStatus.ASSIGNED, toStatus: TicketStatus.IN_PROGRESS, comment: null },
            actor: { email: 'a@b.c', firstName: 'Виктор' },
          },
          {
            at: '2026-09-18T11:00:00Z',
            timelineEvent: 'COMMENT_ADDED',
            payload: { comment: 'Проверил на месте' },
            actor: { email: 'a@b.c' },
          },
        ],
        0,
      ),
    );
    expect(history.text).toContain('История #12');
    expect(history.text).toContain('Статус: Назначена → В работе');
    expect(history.text).toContain('Комментарий');
    expect(history.text).toContain('Проверил на месте');
    expect(history.text).not.toContain('a@b.c');
    expect(history.text).not.toContain('7000');
    expect(buttonsOf(history).map((button) => button.text)).toEqual(['К заявке', 'Меню']);
    expect(history.attachments?.[0]?.payload.buttons.at(-1)?.map((button) => button.text)).toEqual(['Меню']);

    const paged = renderTicketHistoryMessage(
      toTechnicianTicketHistoryPage(
        ID_OLD,
        12,
        Array.from({ length: 6 }, (_, i) => ({
          at: `2026-09-18T1${i}:00:00Z`,
          timelineEvent: 'COMMENT_ADDED',
          payload: { comment: `c${i}` },
          actor: { email: 'a@b.c' },
        })),
        5,
      ),
    );
    const pagedRows = paged.attachments?.[0]?.payload.buttons || [];
    expect(buttonsOf(paged).map((button) => button.text)).toEqual(['Предыдущие', 'К заявке', 'Меню']);
    expect(pagedRows[0]).toEqual([{ type: 'callback', text: 'Предыдущие', payload: `tkh:${ID_OLD}:0` }]);
  });

  it('comment prompt asks for text with cancel; saved returns to the card', () => {
    const prompt = renderCommentPromptMessage(ID_OLD, 12);
    expect(prompt.text).toBe('Введите комментарий к заявке #12');
    expect(buttonsOf(prompt).map((button) => button.text)).toEqual(['Отмена', 'Меню']);
    expect(buttonsOf(prompt)[0].payload).toBe(`tk:${ID_OLD}`);

    const saved = renderCommentSavedMessage(ID_OLD, 12);
    expect(saved.text).toBe('Комментарий добавлен к #12');
    expect(buttonsOf(saved).map((button) => button.text)).toEqual(['К заявке', 'Меню']);
  });

  it('puts complete on the photo/history row and Menu last full width', () => {
    const card = toTechnicianTicketCardView({
      id: ID_OLD,
      ticketNumber: 12,
      status: TicketStatus.ASSIGNED,
      problemText: 'Капает',
      location: { name: 'Кухня' },
      meta: {
        availableActions: { canStart: true, canComplete: true },
        availableStatusTransitions: [TicketStatus.ASSIGNED],
      },
    });
    const rows = renderTechnicianTicketCardMessage(card!).attachments?.[0]?.payload.buttons || [];
    expect(rows.map((row) => row.map((button) => button.text))).toEqual([
      ['Начать работу', 'Комментарий'],
      ['Фото', 'История', 'Завершить'],
      ['Меню'],
    ]);
  });
});
