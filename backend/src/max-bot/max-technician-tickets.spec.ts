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

  it('renders five cards, Open buttons, Next, and never more than seven keys', () => {
    const items = [1, 2, 3, 4, 5].map((n) =>
      listItem({
        id: `${n}1111111-1111-4111-8111-111111111111`,
        ticketNumber: 10 + n,
      }),
    );
    const res = renderTechnicianTicketsListMessage({ items, nextOffset: 5 });
    expect(res.text).toContain('#11 · Назначена · Срочно');
    expect(res.text).toContain('Склад');
    expect(res.text).not.toContain('Телефон');
    const labels = buttonsOf(res).map((button) => button.text);
    expect(labels).toEqual([
      'Открыть #11',
      'Открыть #12',
      'Открыть #13',
      'Открыть #14',
      'Открыть #15',
      'Следующие',
      'Меню',
    ]);
    expect(labels).toHaveLength(7);
    expect(buttonsOf(res).every((button) => button.type === 'callback')).toBe(true);
  });

  it('keeps the section footer when five-plus-next would not overflow', () => {
    const res = renderTechnicianTicketsListMessage({
      items: [listItem({ ticketNumber: 8 })],
      nextOffset: null,
    });
    expect(buttonsOf(res).map((button) => button.text)).toEqual([
      'Открыть #8',
      'Сегодня',
      'Моя смена',
      'Мои заявки',
    ]);
  });

  it('says the list is empty without inventing tickets', () => {
    const res = renderTechnicianTicketsListMessage({ items: [], nextOffset: null });
    expect(res.text).toContain('Нет назначенных заявок');
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Сегодня', 'Моя смена', 'Мои заявки']);
  });

  it('draws card fields and only kernel start/complete/status buttons', () => {
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
    expect(buttonsOf(res).map((button) => button.text)).toEqual([
      'Начать работу',
      'Комментарий',
      'Фото',
      'История',
      'Сегодня',
      'Моя смена',
      'Мои заявки',
    ]);
    expect(buttonsOf(res).map((button) => button.text).join()).not.toMatch(/Принять|Отклонить|Взять/);
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
    expect(buttonsOf(picker).map((button) => button.text)).toEqual([
      'Назначена',
      'Отмена',
      'Сегодня',
      'Моя смена',
      'Мои заявки',
    ]);

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
    expect(buttonsOf(history).map((button) => button.text)).toContain('К заявке');
  });

  it('comment prompt asks for text with cancel; saved returns to the card', () => {
    const prompt = renderCommentPromptMessage(ID_OLD, 12);
    expect(prompt.text).toBe('Введите комментарий к заявке #12');
    expect(buttonsOf(prompt).map((button) => button.text)).toEqual(['Отмена']);
    expect(buttonsOf(prompt)[0].payload).toBe(`tk:${ID_OLD}`);

    const saved = renderCommentSavedMessage(ID_OLD, 12);
    expect(saved.text).toBe('Комментарий добавлен к #12');
    expect(buttonsOf(saved).map((button) => button.text)).toEqual([
      'К заявке',
      'Сегодня',
      'Моя смена',
      'Мои заявки',
    ]);
  });

  it('keeps seven keys when start, comment, complete, status and history would overflow', () => {
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
    const labels = buttonsOf(renderTechnicianTicketCardMessage(card!)).map((button) => button.text);
    expect(labels).toEqual([
      'Начать работу',
      'Комментарий',
      'Фото',
      'Изменить статус',
      'Завершить',
      'История',
      'Меню',
    ]);
    expect(labels).toHaveLength(7);
  });
});
