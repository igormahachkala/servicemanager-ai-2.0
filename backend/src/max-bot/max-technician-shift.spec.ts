import { renderCloseShiftConfirmMessage, renderTechnicianShiftMessage } from './max-technician-shift';

describe('renderTechnicianShiftMessage', () => {
  it('offers open when the shift is closed', () => {
    const res = renderTechnicianShiftMessage({ open: false, openedLabel: null, locationName: null });
    expect(res.text).toContain('Смена не открыта');
    const labels = res.attachments?.[0]?.payload.buttons.flat().map((button) => button.text);
    expect(labels).toEqual(['Открыть смену', 'Сегодня', 'Мои заявки', 'Меню']);
  });

  it('offers close and shows location when the core has one', () => {
    const res = renderTechnicianShiftMessage({
      open: true,
      openedLabel: '17.09, 09:14',
      locationName: 'Склад',
    });
    expect(res.text).toContain('Открыта с 17.09, 09:14');
    expect(res.text).toContain('Объект: Склад');
    const labels = res.attachments?.[0]?.payload.buttons.flat().map((button) => button.text);
    expect(labels).toEqual(['Закрыть смену', 'Сегодня', 'Мои заявки', 'Меню']);
  });
});

describe('renderCloseShiftConfirmMessage', () => {
  it('asks before closing', () => {
    const res = renderCloseShiftConfirmMessage();
    expect(res.text).toBe('Закрыть смену?');
    expect(res.attachments?.[0]?.payload.buttons.flat().map((button) => button.payload)).toEqual([
      'shift_yes',
      'shift_no',
      'menu',
    ]);
  });
});
