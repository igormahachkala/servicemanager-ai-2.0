import { elapsedMinutes, isWorkShiftAutoCloseDue, parseShiftCloseTime } from './workforce-time'

describe('workforce time rules', () => {
  it('validates HH:mm close time', () => {
    expect(parseShiftCloseTime('19:00')).toEqual({ hours: 19, minutes: 0 })
    expect(parseShiftCloseTime('24:00')).toBeNull()
    expect(parseShiftCloseTime('9:00')).toBeNull()
  })

  it('closes at the configured local company time', () => {
    expect(
      isWorkShiftAutoCloseDue({
        openedAt: new Date('2026-08-04T12:00:00.000Z'),
        now: new Date('2026-08-04T16:00:00.000Z'),
        timezone: 'Europe/Moscow',
        closeTime: '19:00',
      }),
    ).toBe(true)
  })

  it('does not close before the configured local time', () => {
    expect(
      isWorkShiftAutoCloseDue({
        openedAt: new Date('2026-08-04T08:00:00.000Z'),
        now: new Date('2026-08-04T15:59:00.000Z'),
        timezone: 'Europe/Moscow',
        closeTime: '19:00',
      }),
    ).toBe(false)
  })

  it('closes an open shift left from an earlier local day', () => {
    expect(
      isWorkShiftAutoCloseDue({
        openedAt: new Date('2026-08-03T10:00:00.000Z'),
        now: new Date('2026-08-04T06:00:00.000Z'),
        timezone: 'Europe/Moscow',
        closeTime: '19:00',
      }),
    ).toBe(true)
  })

  it('rounds active work up to full minutes', () => {
    expect(elapsedMinutes(new Date('2026-08-04T10:00:00Z'), new Date('2026-08-04T10:00:01Z'))).toBe(1)
    expect(elapsedMinutes(new Date('2026-08-04T10:00:00Z'), new Date('2026-08-04T10:05:01Z'))).toBe(6)
  })
})
