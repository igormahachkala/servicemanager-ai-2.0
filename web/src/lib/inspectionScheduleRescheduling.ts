import type { InspectionSchedule, RescheduleNextInspectionOccurrenceInput } from './api'

/** A card hint only: the server also checks ALL runs and canonical access. */
export function canRescheduleNextOccurrence(schedule: InspectionSchedule): boolean {
  return schedule.isActive
    && schedule.frequency !== 'ONCE'
    && (schedule.frequency !== 'CUSTOM'
      || (Number.isInteger(schedule.intervalDays) && (schedule.intervalDays ?? 0) > 0))
    && (schedule._count?.runs ?? 0) > 0
    && schedule.lastRun?.status === 'COMPLETED'
    && Number.isFinite(new Date(schedule.updatedAt).getTime())
    && Number.isFinite(new Date(schedule.nextDueAt).getTime())
}

export type NextOccurrenceDraft = {
  expectedUpdatedAt: string
  expectedNextDueAt: string
  date: string
  time: string
}

const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const localTime = (value: Date) => `${pad(value.getHours())}:${pad(value.getMinutes())}`

export function nextOccurrenceDraft(schedule: InspectionSchedule): NextOccurrenceDraft {
  const due = new Date(schedule.nextDueAt)
  const valid = Number.isFinite(due.getTime())
  return {
    expectedUpdatedAt: schedule.updatedAt,
    expectedNextDueAt: schedule.nextDueAt,
    date: valid ? localDate(due) : '',
    time: valid ? localTime(due) : '',
  }
}

export function buildNextOccurrenceReschedule(
  draft: NextOccurrenceDraft,
  now: Date = new Date(),
): RescheduleNextInspectionOccurrenceInput {
  const original = new Date(draft.expectedNextDueAt)
  if (!Number.isFinite(original.getTime())
    || !Number.isFinite(new Date(draft.expectedUpdatedAt).getTime())) {
    throw new Error('Не удалось определить версию и срок плана. Закройте и откройте перенос заново')
  }
  const target = new Date(`${draft.date}T${draft.time}`)
  // Reject normalized impossible dates and the device timezone's DST gaps.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time)
    || !Number.isFinite(target.getTime())
    || localDate(target) !== draft.date || localTime(target) !== draft.time) {
    throw new Error('Укажите корректные дату и время в часовом поясе вашего устройства')
  }
  // Keeping the same local minute is not a request to truncate original seconds
  // or change which instant an ambiguous DST wall-clock time referred to.
  if (localDate(original) === draft.date && localTime(original) === draft.time) {
    throw new Error('Выберите другой срок')
  }
  if (target.getTime() <= now.getTime()) throw new Error('Новый срок должен быть в будущем')
  return {
    expectedUpdatedAt: draft.expectedUpdatedAt,
    expectedNextDueAt: draft.expectedNextDueAt,
    nextDueAt: target.toISOString(),
  }
}

export function formatOccurrenceDate(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'long' }) : '—'
}
