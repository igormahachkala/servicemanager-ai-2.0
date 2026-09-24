import {
  elapsedMinutes,
  isWorkShiftAutoCloseDue,
  parseShiftCloseTime,
  resolveWorkShiftAutoCloseAt,
} from './workforce-time'

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

// ── SMA-SHIFT-AUTOCLOSE-CORRECTNESS-106A ─────────────────────────────────────

describe('resolveWorkShiftAutoCloseAt', () => {
  const MSK = 'Europe/Moscow' // UTC+3, no DST since 2014

  it('returns the configured boundary, not the sweeper instant, for a same-day shift', () => {
    // Opened 08:00 MSK, sweeper wakes at 19:00:43 MSK. The boundary is 19:00:00 MSK.
    const boundary = resolveWorkShiftAutoCloseAt({
      openedAt: new Date('2026-09-09T05:00:00.000Z'), // 08:00 MSK
      now: new Date('2026-09-09T16:00:43.000Z'), // 19:00:43 MSK
      timezone: MSK,
      closeTime: '19:00',
    })
    expect(boundary?.toISOString()).toBe('2026-09-09T16:00:00.000Z') // 19:00 MSK
  })

  it('is unaffected by how late the sweeper runs', () => {
    const args = {
      openedAt: new Date('2026-09-09T05:00:00.000Z'),
      timezone: MSK,
      closeTime: '19:00',
    }
    const onTime = resolveWorkShiftAutoCloseAt({ ...args, now: new Date('2026-09-09T16:00:01.000Z') })
    const late = resolveWorkShiftAutoCloseAt({ ...args, now: new Date('2026-09-09T16:47:00.000Z') })
    // The whole point of 106A: two sweeper passes minutes apart must agree.
    expect(onTime?.toISOString()).toBe(late?.toISOString())
    expect(late?.toISOString()).toBe('2026-09-09T16:00:00.000Z')
  })

  it('resolves in UTC for a UTC company', () => {
    const boundary = resolveWorkShiftAutoCloseAt({
      openedAt: new Date('2026-09-09T06:00:00.000Z'),
      now: new Date('2026-09-09T19:00:12.000Z'),
      timezone: 'UTC',
      closeTime: '19:00',
    })
    expect(boundary?.toISOString()).toBe('2026-09-09T19:00:00.000Z')
  })

  it('uses the OPEN day boundary when the previous-day rule fires', () => {
    // Opened 08:00 MSK on the 8th; still open when the sweeper runs on the 9th.
    // The boundary belongs to the shift's own day, not to the day the sweeper noticed.
    const boundary = resolveWorkShiftAutoCloseAt({
      openedAt: new Date('2026-09-08T05:00:00.000Z'), // 08:00 MSK, 8 Sep
      now: new Date('2026-09-09T06:00:00.000Z'), // 09:00 MSK, 9 Sep
      timezone: MSK,
      closeTime: '19:00',
    })
    expect(boundary?.toISOString()).toBe('2026-09-08T16:00:00.000Z') // 19:00 MSK, 8 Sep
  })

  it('returns null when the shift opened after the close time (ambiguous night shift)', () => {
    // Opened 20:00 MSK with a 19:00 boundary: its own next boundary is tomorrow 19:00, but the
    // previous-day rule fires at local midnight. 106A refuses to invent a rule here.
    const boundary = resolveWorkShiftAutoCloseAt({
      openedAt: new Date('2026-09-08T17:00:00.000Z'), // 20:00 MSK
      now: new Date('2026-09-08T21:00:30.000Z'), // 00:00:30 MSK next day
      timezone: MSK,
      closeTime: '19:00',
    })
    expect(boundary).toBeNull()
  })

  it('returns null when a shift opened exactly at the close time', () => {
    expect(
      resolveWorkShiftAutoCloseAt({
        openedAt: new Date('2026-09-08T16:00:00.000Z'), // exactly 19:00 MSK
        now: new Date('2026-09-08T21:00:30.000Z'),
        timezone: MSK,
        closeTime: '19:00',
      }),
    ).toBeNull()
  })

  it('returns null for an unparseable close time', () => {
    expect(
      resolveWorkShiftAutoCloseAt({
        openedAt: new Date('2026-09-09T05:00:00.000Z'),
        now: new Date('2026-09-09T16:00:43.000Z'),
        timezone: MSK,
        closeTime: 'nonsense',
      }),
    ).toBeNull()
  })

  it('falls back to UTC for an invalid timezone, as the due-check already did', () => {
    const boundary = resolveWorkShiftAutoCloseAt({
      openedAt: new Date('2026-09-09T06:00:00.000Z'),
      now: new Date('2026-09-09T19:00:12.000Z'),
      timezone: 'Not/AZone',
      closeTime: '19:00',
    })
    expect(boundary?.toISOString()).toBe('2026-09-09T19:00:00.000Z')
  })

  it('lands on the right instant across a DST transition', () => {
    // Berlin leaves DST on 2026-10-25: 19:00 local is UTC+1 that day, UTC+2 the day before.
    const before = resolveWorkShiftAutoCloseAt({
      openedAt: new Date('2026-10-24T06:00:00.000Z'),
      now: new Date('2026-10-24T23:00:00.000Z'),
      timezone: 'Europe/Berlin',
      closeTime: '19:00',
    })
    const after = resolveWorkShiftAutoCloseAt({
      openedAt: new Date('2026-10-25T06:00:00.000Z'),
      now: new Date('2026-10-25T23:00:00.000Z'),
      timezone: 'Europe/Berlin',
      closeTime: '19:00',
    })
    expect(before?.toISOString()).toBe('2026-10-24T17:00:00.000Z') // UTC+2
    expect(after?.toISOString()).toBe('2026-10-25T18:00:00.000Z') // UTC+1
  })

  it('never returns an instant at or before openedAt', () => {
    const openedAt = new Date('2026-09-09T05:00:00.000Z')
    const boundary = resolveWorkShiftAutoCloseAt({
      openedAt,
      now: new Date('2026-09-09T16:00:43.000Z'),
      timezone: MSK,
      closeTime: '19:00',
    })
    expect(boundary!.getTime()).toBeGreaterThan(openedAt.getTime())
  })
})
