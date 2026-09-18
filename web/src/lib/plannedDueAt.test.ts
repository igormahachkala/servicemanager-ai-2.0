import { describe, expect, it } from 'vitest'
import { dateTimeLocalToIso, formatPlannedDueAt, isoToDateTimeLocalValue } from './plannedDueAt'

describe('planned due date helpers', () => {
  it('keeps empty planned due dates nullable', () => {
    expect(dateTimeLocalToIso('')).toBeNull()
    expect(dateTimeLocalToIso('   ')).toBeNull()
    expect(isoToDateTimeLocalValue(null)).toBe('')
    expect(formatPlannedDueAt(null)).toBe('—')
  })

  it('round-trips a local datetime value through ISO safely', () => {
    const iso = dateTimeLocalToIso('2030-01-02T10:30')
    expect(iso).toBeTruthy()
    expect(isoToDateTimeLocalValue(iso)).toMatch(/^2030-01-02T10:30$/)
  })
})
