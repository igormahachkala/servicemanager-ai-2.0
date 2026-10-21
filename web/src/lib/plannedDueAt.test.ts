import { describe, expect, it } from 'vitest'
import { dateTimeLocalToIso, formatPlannedDueAt, isoToDateTimeLocalValue, plannedDueFieldHasContent } from './plannedDueAt'

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

  it('keeps the clear action available while a partially erased value is still on screen', () => {
    // Backspace в одной части datetime-local: value становится '', остаток даты виден, badInput = true.
    expect(plannedDueFieldHasContent('', true)).toBe(true)
    expect(plannedDueFieldHasContent('2030-01-02T10:30', false)).toBe(true)
  })

  it('hides the clear action only when the field is really empty', () => {
    expect(plannedDueFieldHasContent('', false)).toBe(false)
    expect(plannedDueFieldHasContent('   ', false)).toBe(false)
  })
})
