import { elapsedMinutes } from './workforce-time'

/**
 * SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B — the one place shift time is resolved.
 *
 * A shift now has two readings and they must stay separately visible:
 *
 *   recorded  — what the system observed: WorkShift.openedAt / closedAt, including the
 *               boundary 106A writes for an auto-close.
 *   effective — what a manager decided is true, when they have corrected it.
 *
 * Overwriting the recorded values to make reporting simpler would destroy the distinction and
 * with it the audit trail, so corrections live in their own append-only table and are applied
 * here at read time. Every consumer — the shift list today, GET /workforce/matrix later,
 * analytics after that — must call this rather than re-deriving, or the same shift will show
 * two different durations in two screens.
 */

export type ShiftTimeSource = {
  openedAt: Date
  closedAt: Date | null
}

export type ShiftCorrectionSource = {
  correctedOpenedAt: Date | null
  correctedClosedAt: Date | null
}

export type EffectiveShiftTime = {
  /** As recorded by the system; never mutated by a correction. */
  recordedOpenedAt: Date
  recordedClosedAt: Date | null
  /** What reporting should use. */
  effectiveOpenedAt: Date
  effectiveClosedAt: Date | null
  /**
   * Null while the shift is still open. Deliberately not "minutes until now": a running total
   * changes between two reads of the same report and cannot be summed into a monthly figure.
   */
  effectiveDurationMinutes: number | null
  isCorrected: boolean
  correctedFields: Array<'openedAt' | 'closedAt'>
}

/**
 * Applies at most one correction — the newest, which supersedes any earlier one. A null field
 * inside a correction means "leave the recorded value alone", so a manager can fix only the end
 * of a shift without restating its start.
 */
export function resolveEffectiveShiftTime(
  shift: ShiftTimeSource,
  correction?: ShiftCorrectionSource | null,
): EffectiveShiftTime {
  const correctedFields: Array<'openedAt' | 'closedAt'> = []

  const effectiveOpenedAt = correction?.correctedOpenedAt ?? shift.openedAt
  if (correction?.correctedOpenedAt) correctedFields.push('openedAt')

  const effectiveClosedAt = correction?.correctedClosedAt ?? shift.closedAt
  if (correction?.correctedClosedAt) correctedFields.push('closedAt')

  return {
    recordedOpenedAt: shift.openedAt,
    recordedClosedAt: shift.closedAt,
    effectiveOpenedAt,
    effectiveClosedAt,
    effectiveDurationMinutes: effectiveClosedAt
      ? elapsedMinutes(effectiveOpenedAt, effectiveClosedAt)
      : null,
    isCorrected: correctedFields.length > 0,
    correctedFields,
  }
}

/** The newest correction for a shift, given rows in any order. */
export function latestCorrection<T extends { createdAt: Date }>(corrections: T[]): T | null {
  if (!corrections.length) return null
  return corrections.reduce((newest, row) => (row.createdAt > newest.createdAt ? row : newest))
}
