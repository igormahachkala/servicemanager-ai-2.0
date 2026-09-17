import {
  isTechnicianSectionPayload,
  matchTechnicianMenuLabel,
  renderTechnicianMenuMessage,
  renderTechnicianSectionMessage,
  technicianSectionLabel,
} from './max-technician-menu';

function labelsOf(response: ReturnType<typeof renderTechnicianMenuMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-technician-menu', () => {
  it('renders six section callbacks in two rows of three', () => {
    const res = renderTechnicianMenuMessage();
    expect(res.text).toContain('Выберите действие');
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(3);
    expect(rows[1]).toHaveLength(3);
    expect(labelsOf(res)).toEqual([
      'Сегодня',
      'Мои заявки',
      'Доступные',
      'Обходы',
      'Моя смена',
      'Поиск заявки',
    ]);
    expect(rows.flat().every((button) => button.type === 'callback')).toBe(true);
  });

  it('section reply is the section name plus Меню, not the six buttons', () => {
    const res = renderTechnicianSectionMessage('today');
    expect(res.text).toBe('Сегодня');
    expect(labelsOf(res)).toEqual(['Меню']);
    expect(renderTechnicianSectionMessage('shift').text).toBe('Моя смена');
    expect(technicianSectionLabel('my')).toBe('Мои заявки');
  });

  it('matches labels and payloads', () => {
    expect(matchTechnicianMenuLabel('Сегодня')).toBe('today');
    expect(matchTechnicianMenuLabel('  Моя смена  ')).toBe('shift');
    expect(matchTechnicianMenuLabel('привет')).toBeNull();
    expect(isTechnicianSectionPayload('today')).toBe(true);
    expect(isTechnicianSectionPayload('help')).toBe(false);
  });
});
