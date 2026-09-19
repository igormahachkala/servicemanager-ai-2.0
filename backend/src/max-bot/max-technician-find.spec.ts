import {
  parseFindTicketNumber,
  renderFindEmptyMessage,
  renderFindPromptMessage,
  renderFindResultsMessage,
  ticketMatchesFindQuery,
} from './max-technician-find';

const ID = '11111111-1111-4111-8111-111111111111';

function labelsOf(response: ReturnType<typeof renderFindPromptMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-technician-find', () => {
  it('parses a ticket number with or without hash', () => {
    expect(parseFindTicketNumber('421')).toBe(421);
    expect(parseFindTicketNumber(' #12 ')).toBe(12);
    expect(parseFindTicketNumber('холод')).toBeNull();
    expect(parseFindTicketNumber('12 холодильник')).toBeNull();
  });

  it('matches number, problem, requester, location and address, never phones', () => {
    const ticket = {
      id: ID,
      ticketNumber: 421,
      problemText: 'Не морозит камера',
      requesterName: 'Иван',
      requesterPhone: '79990001122',
      createdByUser: { firstName: 'Клиент', lastName: 'Петров', phone: '70001112233' },
      location: { name: 'Фудзияма', address: 'Ленина 10', city: 'Томск' },
    };
    expect(ticketMatchesFindQuery(ticket, '#421')).toBe(true);
    expect(ticketMatchesFindQuery(ticket, 'морозит')).toBe(true);
    expect(ticketMatchesFindQuery(ticket, 'Иван')).toBe(true);
    expect(ticketMatchesFindQuery(ticket, 'петров')).toBe(true);
    expect(ticketMatchesFindQuery(ticket, 'ленина')).toBe(true);
    expect(ticketMatchesFindQuery(ticket, '7999')).toBe(false);
    expect(ticketMatchesFindQuery(ticket, '7000')).toBe(false);
  });

  it('prompts for a query with cancel and menu', () => {
    const res = renderFindPromptMessage();
    expect(res.text).toBe('Напишите номер, описание, имя или адрес заявки');
    expect(labelsOf(res)).toEqual(['Отмена', 'Меню']);
  });

  it('renders matches as #{id} with paging and menu', () => {
    const res = renderFindResultsMessage({
      items: [
        {
          id: ID,
          ticketNumber: 12,
          locationName: 'Склад',
          problemText: 'Не морозит',
          urgencyLabel: 'Срочно',
          statusLabel: 'Назначена',
        },
      ],
      prevOffset: null,
      nextOffset: 6,
    });
    expect(res.text).toContain('Поиск заявки');
    expect(res.text).not.toContain('Телефон');
    expect(labelsOf(res)).toEqual(['#12', 'Следующие', 'Меню']);
    expect(renderFindEmptyMessage().text).toContain('Ничего не найдено');
  });
});
