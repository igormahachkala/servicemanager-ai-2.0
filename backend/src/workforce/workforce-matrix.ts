import type { WorkShiftStatus } from '@prisma/client'

import {
  latestCorrection,
  resolveEffectiveShiftTime,
  type EffectiveShiftTime,
} from './workforce-effective-time'
import { localDateKey } from './workforce-time'

/**
 * SMA-WORKFORCE-MONTHLY-MATRIX-106D — Сотрудник × День × Месяц, built in one pass.
 *
 * Pure: takes shift rows already fetched and returns the grid. Keeping the shaping out of the
 * service is what lets month-boundary, timezone and totals behaviour be tested without a
 * database, and it keeps the single effective-time resolver from 106B as the only place
 * recorded and corrected time are reconciled.
 *
 * What this deliberately does NOT compute: payable hours, norm, overtime, undertime. There is no
 * lunch policy and no daily norm in the schema yet, so any such number would be invented. Every
 * total below is a plain observed fact and is labelled as one.
 */

export type MatrixShiftRow = {
  id: string
  userId: string
  status: WorkShiftStatus
  openedAt: Date
  closedAt: Date | null
  closeReason: string | null
  user: { id: string; firstName: string | null; lastName: string | null; email: string; role: string }
  corrections: Array<{
    id: string
    correctedOpenedAt: Date | null
    correctedClosedAt: Date | null
    reason: string
    createdAt: Date
    correctedBy: { id: string; firstName: string | null; lastName: string | null; email: string } | null
  }>
}

/** What a single cell of the grid says. */
export type MatrixDayCell = {
  date: string
  /**
   * none        — no shift started that day
   * open        — a shift is running; contributes no minutes on purpose
   * closed      — manually closed
   * auto_closed — closed by the sweeper; flagged, NOT assumed wrong
   */
  state: 'none' | 'open' | 'closed' | 'auto_closed'
  /** Sum of effective durations of the day's finished shifts. Null when nothing finished. */
  durationMinutes: number | null
  hasCorrection: boolean
  hasOpenShift: boolean
  shiftIds: string[]
}

export type MatrixEmployeeTotals = {
  /** Hours actually recorded as worked on finished shifts. Not payable hours — no policy exists. */
  closedShiftMinutes: number
  closedShifts: number
  autoClosedShifts: number
  correctedShifts: number
  openShifts: number
  /** Calendar days of the month with no finished shift. Not "absence" — that is not modelled. */
  daysWithoutClosedShift: number
}

export type MatrixEmployeeRow = {
  user: MatrixShiftRow['user']
  days: MatrixDayCell[]
  totals: MatrixEmployeeTotals
}

export type MatrixShiftDetail = {
  id: string
  date: string
  status: WorkShiftStatus
  closeReason: string | null
  effective: EffectiveShiftTime
  corrections: MatrixShiftRow['corrections']
}

function emptyTotals(): MatrixEmployeeTotals {
  return {
    closedShiftMinutes: 0,
    closedShifts: 0,
    autoClosedShifts: 0,
    correctedShifts: 0,
    openShifts: 0,
    daysWithoutClosedShift: 0,
  }
}

function displayName(user: MatrixShiftRow['user']) {
  return [user.lastName, user.firstName].filter(Boolean).join(' ').trim() || user.email
}

/**
 * Builds the grid.
 *
 * `days` comes from the caller because the month's local day keys are a timezone decision, and
 * making it an input keeps this function honest about the fact that a "day" is not a UTC day.
 */
export function buildWorkforceMatrix(params: {
  shifts: MatrixShiftRow[]
  days: string[]
  timezone?: string | null
}): { employees: MatrixEmployeeRow[]; totals: MatrixEmployeeTotals & { employees: number }; shifts: MatrixShiftDetail[] } {
  const { shifts, days, timezone } = params

  const byUser = new Map<string, { user: MatrixShiftRow['user']; cells: Map<string, MatrixDayCell> }>()
  const details: MatrixShiftDetail[] = []

  for (const shift of shifts) {
    // The day a shift belongs to is the day it STARTED, in the company's zone.
    const date = localDateKey(shift.openedAt, timezone)
    const applied = latestCorrection(shift.corrections)
    const effective = resolveEffectiveShiftTime(shift, applied)

    details.push({
      id: shift.id,
      date,
      status: shift.status,
      closeReason: shift.closeReason,
      effective,
      corrections: shift.corrections,
    })

    const employee = byUser.get(shift.userId) ?? { user: shift.user, cells: new Map() }
    const cell =
      employee.cells.get(date) ??
      ({ date, state: 'none', durationMinutes: null, hasCorrection: false, hasOpenShift: false, shiftIds: [] } as MatrixDayCell)

    cell.shiftIds.push(shift.id)
    if (effective.isCorrected) cell.hasCorrection = true

    if (shift.status === 'OPEN') {
      cell.hasOpenShift = true
      // An open shift contributes no minutes: 106B returns a null effective duration for it on
      // purpose, and turning that into "minutes so far" would make a month total change between
      // two reads of the same report.
      if (cell.state === 'none') cell.state = 'open'
    } else {
      const minutes = effective.effectiveDurationMinutes ?? 0
      cell.durationMinutes = (cell.durationMinutes ?? 0) + minutes
      // auto_closed wins the cell's label when a day mixes both: it is the state a manager needs
      // to notice. It is a flag for inspection, not a claim that the record is wrong.
      if (shift.status === 'AUTO_CLOSED') cell.state = 'auto_closed'
      else if (cell.state !== 'auto_closed') cell.state = 'closed'
    }

    employee.cells.set(date, cell)
    byUser.set(shift.userId, employee)
  }

  const employees: MatrixEmployeeRow[] = [...byUser.values()]
    .map(({ user, cells }) => {
      const totals = emptyTotals()
      const row = days.map(
        (date) =>
          cells.get(date) ??
          ({ date, state: 'none', durationMinutes: null, hasCorrection: false, hasOpenShift: false, shiftIds: [] } as MatrixDayCell),
      )

      for (const cell of row) {
        if (cell.durationMinutes === null) totals.daysWithoutClosedShift += 1
        else totals.closedShiftMinutes += cell.durationMinutes
      }

      return { user, days: row, totals }
    })
    .sort((a, b) => displayName(a.user).localeCompare(displayName(b.user), 'ru'))

  // Shift-level counters are counted from the shifts themselves, not from cells: a day holding
  // two shifts must count as two.
  for (const detail of details) {
    const employee = employees.find((row) => row.days.some((cell) => cell.shiftIds.includes(detail.id)))
    if (!employee) continue
    if (detail.status === 'OPEN') employee.totals.openShifts += 1
    else employee.totals.closedShifts += 1
    if (detail.status === 'AUTO_CLOSED') employee.totals.autoClosedShifts += 1
    if (detail.effective.isCorrected) employee.totals.correctedShifts += 1
  }

  const totals = employees.reduce(
    (sum, row) => ({
      closedShiftMinutes: sum.closedShiftMinutes + row.totals.closedShiftMinutes,
      closedShifts: sum.closedShifts + row.totals.closedShifts,
      autoClosedShifts: sum.autoClosedShifts + row.totals.autoClosedShifts,
      correctedShifts: sum.correctedShifts + row.totals.correctedShifts,
      openShifts: sum.openShifts + row.totals.openShifts,
      daysWithoutClosedShift: sum.daysWithoutClosedShift + row.totals.daysWithoutClosedShift,
      employees: sum.employees,
    }),
    { ...emptyTotals(), employees: employees.length },
  )

  return { employees, totals, shifts: details }
}
