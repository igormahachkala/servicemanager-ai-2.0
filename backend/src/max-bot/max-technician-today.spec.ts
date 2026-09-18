import { renderTechnicianTodayMessage } from './max-technician-today';

describe('renderTechnicianTodayMessage', () => {
  it('shows shift counters and jumps without ticket details', () => {
    const res = renderTechnicianTodayMessage({
      shiftOpen: true,
      shiftOpenedLabel: '17.09, 09:14',
      myActiveCount: 3,
      overdueCount: 1,
      roundsTodayCount: 2,
    });
    expect(res.text).toContain('Сегодня');
    expect(res.text).toContain('Смена: открыта с 17.09, 09:14');
    expect(res.text).toContain('Заявки: 3, просрочено 1');
    expect(res.text).toContain('Обходы сегодня: 2');
    expect(res.text).not.toContain('Телефон');
    const labels = res.attachments?.[0]?.payload.buttons.flat().map((button) => button.text);
    expect(labels).toEqual(['Мои заявки', 'Моя смена', 'Меню']);
  });

  it('says the shift is closed', () => {
    const res = renderTechnicianTodayMessage({
      shiftOpen: false,
      shiftOpenedLabel: null,
      myActiveCount: 0,
      overdueCount: 0,
      roundsTodayCount: 0,
    });
    expect(res.text).toContain('Смена: не открыта');
  });
});
