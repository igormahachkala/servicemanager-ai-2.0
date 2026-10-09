import {
  isTechnicianSectionPayload,
  matchTechnicianMenuLabel,
  paginationRows,
  renderTechnicianMenuMessage,
  renderTechnicianSectionMessage,
  technicianSectionLabel,
} from './max-technician-menu';

function labelsOf(response: ReturnType<typeof renderTechnicianMenuMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-technician-menu', () => {
  it('renders the ready section callbacks', () => {
    const res = renderTechnicianMenuMessage();
    expect(res.text).toContain('Выберите действие');
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(rows).toHaveLength(5);
    expect(rows.slice(0, 3).every((row) => row.length === 2)).toBe(true);
    expect(rows[3].map((button) => button.text)).toEqual(['Памятки']);
    expect(rows[4].map((button) => button.text)).toEqual(['Сообщить об ошибке']);
    expect(labelsOf(res)).toEqual([
      'Сегодня',
      'Моя смена',
      'Мои заявки',
      'Доступные',
      'Обходы',
      'Поиск заявки',
      'Памятки',
      'Сообщить об ошибке',
    ]);
    expect(rows.flat().every((button) => button.type === 'callback')).toBe(true);
  });

  it('unfinished section reply is the section name plus the technician footer', () => {
    const res = renderTechnicianSectionMessage('avail');
    expect(res.text).toBe('Доступные');
    expect(labelsOf(res)).toEqual(['Сообщить об ошибке', 'Меню']);
    expect(renderTechnicianSectionMessage('find').text).toBe('Поиск заявки');
    expect(technicianSectionLabel('my')).toBe('Мои заявки');
  });

  it('matches labels and payloads', () => {
    expect(matchTechnicianMenuLabel('Сегодня')).toBe('today');
    expect(matchTechnicianMenuLabel('  Моя смена  ')).toBe('shift');
    expect(matchTechnicianMenuLabel('привет')).toBeNull();
    expect(isTechnicianSectionPayload('today')).toBe(true);
    expect(isTechnicianSectionPayload('help')).toBe(false);
  });

  it('puts prev/next on one row and stretches a lone paging button', () => {
    expect(paginationRows('my:0', 'my:12')[0]?.map((button) => button.text)).toEqual(['Предыдущие', 'Следующие']);
    expect(paginationRows(null, 'my:6')).toEqual([[{ type: 'callback', text: 'Следующие', payload: 'my:6' }]]);
    expect(paginationRows('my:0', null)).toEqual([[{ type: 'callback', text: 'Предыдущие', payload: 'my:0' }]]);
    expect(paginationRows(null, null)).toEqual([]);
  });
});
