import { latestCorrection, resolveEffectiveShiftTime } from './workforce-effective-time'

/** SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B — the single resolver every consumer must use. */

const OPENED = new Date('2026-09-09T05:00:00.000Z')
const CLOSED = new Date('2026-09-09T16:00:00.000Z') // 106A boundary, 11 h later

describe('resolveEffectiveShiftTime', () => {
  it('uses the recorded values when there is no correction', () => {
    const r = resolveEffectiveShiftTime({ openedAt: OPENED, closedAt: CLOSED }, null)

    expect(r.effectiveOpenedAt).toEqual(OPENED)
    expect(r.effectiveClosedAt).toEqual(CLOSED)
    expect(r.effectiveDurationMinutes).toBe(660)
    expect(r.isCorrected).toBe(false)
    expect(r.correctedFields).toEqual([])
  })

  it('applies a corrected closedAt and recomputes the duration', () => {
    // The forgotten-close case from the task: auto-closed wrongly, actual end 18:07 local.
    const r = resolveEffectiveShiftTime(
      { openedAt: OPENED, closedAt: CLOSED },
      { correctedOpenedAt: null, correctedClosedAt: new Date('2026-09-09T15:07:00.000Z') },
    )

    expect(r.recordedClosedAt).toEqual(CLOSED) // recorded value survives untouched
    expect(r.effectiveClosedAt).toEqual(new Date('2026-09-09T15:07:00.000Z'))
    expect(r.effectiveDurationMinutes).toBe(607)
    expect(r.correctedFields).toEqual(['closedAt'])
    expect(r.isCorrected).toBe(true)
  })

  it('applies a corrected openedAt', () => {
    const r = resolveEffectiveShiftTime(
      { openedAt: OPENED, closedAt: CLOSED },
      { correctedOpenedAt: new Date('2026-09-09T06:00:00.000Z'), correctedClosedAt: null },
    )

    expect(r.recordedOpenedAt).toEqual(OPENED)
    expect(r.effectiveOpenedAt).toEqual(new Date('2026-09-09T06:00:00.000Z'))
    expect(r.effectiveDurationMinutes).toBe(600)
    expect(r.correctedFields).toEqual(['openedAt'])
  })

  it('applies both ends when both are corrected', () => {
    const r = resolveEffectiveShiftTime(
      { openedAt: OPENED, closedAt: CLOSED },
      {
        correctedOpenedAt: new Date('2026-09-09T06:00:00.000Z'),
        correctedClosedAt: new Date('2026-09-09T15:00:00.000Z'),
      },
    )

    expect(r.effectiveDurationMinutes).toBe(540)
    expect(r.correctedFields).toEqual(['openedAt', 'closedAt'])
  })

  it('reports no duration while the shift is still open', () => {
    // Not "minutes until now": a running total cannot be summed into a monthly figure and
    // would differ between two reads of the same report.
    const r = resolveEffectiveShiftTime({ openedAt: OPENED, closedAt: null }, null)

    expect(r.effectiveClosedAt).toBeNull()
    expect(r.effectiveDurationMinutes).toBeNull()
  })

  it('leaves the untouched end alone when only one end is corrected', () => {
    const r = resolveEffectiveShiftTime(
      { openedAt: OPENED, closedAt: CLOSED },
      { correctedOpenedAt: null, correctedClosedAt: null },
    )

    expect(r.effectiveOpenedAt).toEqual(OPENED)
    expect(r.effectiveClosedAt).toEqual(CLOSED)
    expect(r.isCorrected).toBe(false)
  })
})

describe('latestCorrection', () => {
  it('returns null when there are none', () => {
    expect(latestCorrection([])).toBeNull()
  })

  it('picks the newest regardless of input order, so a later fix supersedes an earlier one', () => {
    const older = { id: 'a', createdAt: new Date('2026-09-09T10:00:00.000Z') }
    const newer = { id: 'b', createdAt: new Date('2026-09-09T12:00:00.000Z') }

    expect(latestCorrection([older, newer])?.id).toBe('b')
    expect(latestCorrection([newer, older])?.id).toBe('b')
  })
})
