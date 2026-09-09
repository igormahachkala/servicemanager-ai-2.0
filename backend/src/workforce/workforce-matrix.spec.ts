import { WorkShiftStatus } from '@prisma/client'

import { buildWorkforceMatrix, type MatrixShiftRow } from './workforce-matrix'
import { localDateKey, monthRangeInTimeZone } from './workforce-time'

/** SMA-WORKFORCE-MONTHLY-MATRIX-106D. */

const MSK = 'Europe/Moscow' // UTC+3

const user = (id: string, last: string) => ({
  id,
  firstName: 'И',
  lastName: last,
  email: `${id}@x.local`,
  role: 'TECHNICIAN',
})

function shift(over: Partial<MatrixShiftRow> & { id: string; openedAt: Date }): MatrixShiftRow {
  return {
    userId: 'u1',
    status: WorkShiftStatus.CLOSED,
    closedAt: null,
    closeReason: null,
    user: user('u1', 'Иванов'),
    corrections: [],
    ...over,
  } as MatrixShiftRow
}

const SEPT = monthRangeInTimeZone('2026-09', MSK)!

// ── month range and timezone boundaries ──────────────────────────────────────

describe('monthRangeInTimeZone', () => {
  it('starts and ends at local midnight, not UTC midnight', () => {
    // September in Moscow begins at 21:00 UTC on 31 August.
    expect(SEPT.from.toISOString()).toBe('2026-08-31T21:00:00.000Z')
    expect(SEPT.to.toISOString()).toBe('2026-09-30T21:00:00.000Z')
    expect(SEPT.days).toHaveLength(30)
    expect(SEPT.days[0]).toBe('2026-09-01')
    expect(SEPT.days[29]).toBe('2026-09-30')
  })

  it('produces UTC boundaries for a UTC company', () => {
    const utc = monthRangeInTimeZone('2026-09', 'UTC')!
    expect(utc.from.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(utc.to.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('handles December rolling into the next year', () => {
    const dec = monthRangeInTimeZone('2026-12', 'UTC')!
    expect(dec.to.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(dec.days).toHaveLength(31)
  })

  it('rejects a malformed month', () => {
    expect(monthRangeInTimeZone('2026-13', 'UTC')).toBeNull()
    expect(monthRangeInTimeZone('nope', 'UTC')).toBeNull()
  })

  it('assigns a shift to its LOCAL day, which can differ from the UTC day', () => {
    // 22:30 UTC on the 8th is 01:30 on the 9th in Moscow.
    const instant = new Date('2026-09-08T22:30:00.000Z')
    expect(localDateKey(instant, 'UTC')).toBe('2026-09-08')
    expect(localDateKey(instant, MSK)).toBe('2026-09-09')
  })
})

// ── grid shaping ─────────────────────────────────────────────────────────────

describe('buildWorkforceMatrix', () => {
  it('renders a closed shift as hours on its local day', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({
          id: 's1',
          openedAt: new Date('2026-09-09T05:00:00.000Z'), // 08:00 MSK
          closedAt: new Date('2026-09-09T13:14:00.000Z'), // 16:14 MSK
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    const cell = m.employees[0].days.find((d) => d.date === '2026-09-09')!
    expect(cell.state).toBe('closed')
    expect(cell.durationMinutes).toBe(494) // 8 h 14
    expect(m.employees[0].totals.closedShiftMinutes).toBe(494)
    expect(m.employees[0].totals.closedShifts).toBe(1)
  })

  it('flags an AUTO_CLOSED shift without discarding its hours', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({
          id: 's1',
          status: WorkShiftStatus.AUTO_CLOSED,
          closeReason: 'AUTO_CLOSE_19:00',
          openedAt: new Date('2026-09-09T05:00:00.000Z'),
          closedAt: new Date('2026-09-09T16:00:00.000Z'),
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    const cell = m.employees[0].days.find((d) => d.date === '2026-09-09')!
    expect(cell.state).toBe('auto_closed')
    expect(cell.durationMinutes).toBe(660) // still counted — flagged, not assumed wrong
    expect(m.employees[0].totals.autoClosedShifts).toBe(1)
  })

  it('uses the corrected duration and marks the cell as corrected', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({
          id: 's1',
          status: WorkShiftStatus.AUTO_CLOSED,
          openedAt: new Date('2026-09-09T05:00:00.000Z'), // 08:00 MSK
          closedAt: new Date('2026-09-09T16:00:00.000Z'), // 19:00 MSK recorded
          corrections: [
            {
              id: 'c1',
              correctedOpenedAt: null,
              correctedClosedAt: new Date('2026-09-09T15:07:00.000Z'), // 18:07 MSK actual
              reason: 'забыл закрыть',
              createdAt: new Date('2026-09-10T08:00:00.000Z'),
              correctedBy: { id: 'm1', firstName: 'М', lastName: 'Петров', email: 'm@x' },
            },
          ],
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    const cell = m.employees[0].days.find((d) => d.date === '2026-09-09')!
    expect(cell.hasCorrection).toBe(true)
    expect(cell.durationMinutes).toBe(607) // effective, not recorded 660
    expect(m.employees[0].totals.correctedShifts).toBe(1)

    // The recorded values stay visible for the day detail.
    const detail = m.shifts.find((s) => s.id === 's1')!
    expect(detail.effective.recordedClosedAt).toEqual(new Date('2026-09-09T16:00:00.000Z'))
    expect(detail.effective.effectiveClosedAt).toEqual(new Date('2026-09-09T15:07:00.000Z'))
  })

  it('shows an OPEN shift as active and contributes zero minutes to the month', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({
          id: 's1',
          status: WorkShiftStatus.OPEN,
          openedAt: new Date('2026-09-09T05:00:00.000Z'),
          closedAt: null,
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    const cell = m.employees[0].days.find((d) => d.date === '2026-09-09')!
    expect(cell.state).toBe('open')
    expect(cell.hasOpenShift).toBe(true)
    expect(cell.durationMinutes).toBeNull()
    // An open shift must not inflate the month.
    expect(m.employees[0].totals.closedShiftMinutes).toBe(0)
    expect(m.employees[0].totals.openShifts).toBe(1)
    expect(m.employees[0].totals.closedShifts).toBe(0)
  })

  it('marks days with no shift and counts them', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({
          id: 's1',
          openedAt: new Date('2026-09-09T05:00:00.000Z'),
          closedAt: new Date('2026-09-09T13:00:00.000Z'),
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    expect(m.employees[0].days.find((d) => d.date === '2026-09-10')!.state).toBe('none')
    expect(m.employees[0].days).toHaveLength(30)
    expect(m.employees[0].totals.daysWithoutClosedShift).toBe(29)
  })

  it('sums two shifts on the same day and counts both', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({
          id: 's1',
          openedAt: new Date('2026-09-09T05:00:00.000Z'),
          closedAt: new Date('2026-09-09T09:00:00.000Z'), // 240 min
        }),
        shift({
          id: 's2',
          openedAt: new Date('2026-09-09T11:00:00.000Z'),
          closedAt: new Date('2026-09-09T14:00:00.000Z'), // 180 min
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    const cell = m.employees[0].days.find((d) => d.date === '2026-09-09')!
    expect(cell.durationMinutes).toBe(420)
    expect(cell.shiftIds).toEqual(['s1', 's2'])
    expect(m.employees[0].totals.closedShifts).toBe(2)
  })

  it('lets auto_closed win a mixed day so a manager notices it', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({ id: 's1', openedAt: new Date('2026-09-09T05:00:00.000Z'), closedAt: new Date('2026-09-09T09:00:00.000Z') }),
        shift({
          id: 's2',
          status: WorkShiftStatus.AUTO_CLOSED,
          openedAt: new Date('2026-09-09T11:00:00.000Z'),
          closedAt: new Date('2026-09-09T16:00:00.000Z'),
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    expect(m.employees[0].days.find((d) => d.date === '2026-09-09')!.state).toBe('auto_closed')
  })

  it('separates employees and sorts them by name', () => {
    const m = buildWorkforceMatrix({
      shifts: [
        shift({ id: 's1', userId: 'u2', user: user('u2', 'Яковлев'), openedAt: new Date('2026-09-09T05:00:00.000Z'), closedAt: new Date('2026-09-09T09:00:00.000Z') }),
        shift({ id: 's2', userId: 'u1', user: user('u1', 'Абрамов'), openedAt: new Date('2026-09-09T05:00:00.000Z'), closedAt: new Date('2026-09-09T13:00:00.000Z') }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    expect(m.employees.map((e) => e.user.lastName)).toEqual(['Абрамов', 'Яковлев'])
    expect(m.employees[0].totals.closedShiftMinutes).toBe(480)
    expect(m.employees[1].totals.closedShiftMinutes).toBe(240)
    expect(m.totals.employees).toBe(2)
    expect(m.totals.closedShiftMinutes).toBe(720)
  })

  it('places a shift opened just before local midnight on the correct day', () => {
    // 20:30 UTC on 30 Sep is 23:30 MSK the same day — the last day of the month, not October.
    const m = buildWorkforceMatrix({
      shifts: [
        shift({
          id: 's1',
          openedAt: new Date('2026-09-30T20:30:00.000Z'),
          closedAt: new Date('2026-09-30T21:30:00.000Z'),
        }),
      ],
      days: SEPT.days,
      timezone: MSK,
    })

    expect(m.employees[0].days.find((d) => d.date === '2026-09-30')!.state).toBe('closed')
  })

  it('returns an empty grid when the month has no shifts at all', () => {
    const m = buildWorkforceMatrix({ shifts: [], days: SEPT.days, timezone: MSK })

    expect(m.employees).toEqual([])
    expect(m.totals.employees).toBe(0)
    expect(m.totals.closedShiftMinutes).toBe(0)
  })
})
