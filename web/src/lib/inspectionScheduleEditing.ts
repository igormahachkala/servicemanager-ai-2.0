import type { EditNotStartedInspectionScheduleInput, InspectionFrequency, InspectionSchedule } from './api'

export const SCHEDULE_EDIT_FREQUENCIES: Record<InspectionFrequency, string> = {
  ONCE: 'Однократно',
  DAILY: 'Ежедневно',
  WEEKLY: 'Еженедельно',
  BIWEEKLY: 'Раз в две недели',
  MONTHLY: 'Ежемесячно',
  QUARTERLY: 'Раз в квартал',
  SEMIANNUAL: 'Раз в полгода',
  ANNUAL: 'Ежегодно',
  CUSTOM: 'Свой интервал',
}

/** Deliberately not an editor for the next occurrence of an already-used plan. */
export function canEditNotStartedSchedule(schedule: InspectionSchedule): boolean {
  return schedule.isActive
    && schedule._count?.runs === 0
    && !schedule.lastGeneratedAt
    && !schedule.lastRunId
    && !schedule.lastRun
    && Number.isFinite(new Date(schedule.updatedAt).getTime())
}

export type ScheduleEditDraft = {
  expectedUpdatedAt: string
  originalStartDate: string
  clientCompanyId: string
  templateId: string
  locationId: string
  equipmentId: string
  assignedToUserId: string
  name: string
  frequency: InspectionFrequency
  intervalDays: string
  date: string
  time: string
}

const pad = (value: number) => String(value).padStart(2, '0')

export function scheduleEditDraft(schedule: InspectionSchedule): ScheduleEditDraft {
  const start = new Date(schedule.startDate)
  const validDate = Number.isFinite(start.getTime())
  return {
    expectedUpdatedAt: schedule.updatedAt,
    originalStartDate: schedule.startDate,
    clientCompanyId: schedule.location.clientCompanyId === schedule.companyId
      ? '' : schedule.location.clientCompanyId || '',
    templateId: schedule.template.id,
    locationId: schedule.location.id,
    equipmentId: schedule.equipment?.id || '',
    assignedToUserId: schedule.assignedTo?.id || '',
    name: schedule.name,
    frequency: schedule.frequency,
    intervalDays: schedule.intervalDays == null ? '' : String(schedule.intervalDays),
    date: validDate ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}` : '',
    time: validDate ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '',
  }
}

/** Location-dependent values are cleared only by an explicit scope change, not a failed query. */
export function changeScheduleEditLocation(draft: ScheduleEditDraft, locationId: string): ScheduleEditDraft {
  if (draft.locationId === locationId) return draft
  return { ...draft, locationId, equipmentId: '', assignedToUserId: '' }
}

export function changeScheduleEditClient(draft: ScheduleEditDraft, clientCompanyId: string): ScheduleEditDraft {
  if (draft.clientCompanyId === clientCompanyId) return draft
  return { ...draft, clientCompanyId, locationId: '', equipmentId: '', assignedToUserId: '' }
}

export function buildNotStartedScheduleEdit(draft: ScheduleEditDraft): EditNotStartedInspectionScheduleInput {
  const name = draft.name.trim()
  if (!name || name.length > 160) throw new Error('Укажите название плана — от 1 до 160 символов')
  if (!draft.templateId) throw new Error('Выберите шаблон обхода')
  if (!draft.locationId) throw new Error('Выберите точку')
  if (!Object.hasOwn(SCHEDULE_EDIT_FREQUENCIES, draft.frequency)) throw new Error('Выберите повторение')
  if (!Number.isFinite(new Date(draft.expectedUpdatedAt).getTime())) {
    throw new Error('Не удалось определить версию плана. Закройте и откройте редактор заново')
  }

  const start = new Date(`${draft.date}T${draft.time}`)
  // Date normalizes impossible calendar values (e.g. 31 February) and DST gaps; reject both.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time)
    || !Number.isFinite(start.getTime())
    || `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}` !== draft.date
    || `${pad(start.getHours())}:${pad(start.getMinutes())}` !== draft.time) {
    throw new Error('Укажите корректные дату и время в вашем часовом поясе')
  }

  const intervalDays = draft.frequency === 'CUSTOM' ? Number(draft.intervalDays) : null
  if (intervalDays !== null && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650)) {
    throw new Error('Для своего интервала укажите целое число дней от 1 до 3650')
  }
  const original = new Date(draft.originalStartDate)
  const unchangedLocalTime = Number.isFinite(original.getTime())
    && `${original.getFullYear()}-${pad(original.getMonth() + 1)}-${pad(original.getDate())}` === draft.date
    && `${pad(original.getHours())}:${pad(original.getMinutes())}` === draft.time
  return {
    expectedUpdatedAt: draft.expectedUpdatedAt,
    templateId: draft.templateId,
    locationId: draft.locationId,
    equipmentId: draft.equipmentId || null,
    assignedToUserId: draft.assignedToUserId || null,
    name,
    frequency: draft.frequency,
    intervalDays,
    startDate: unchangedLocalTime ? original.toISOString() : start.toISOString(),
  }
}

export type ScheduleEditOptions = {
  templates: readonly { id: string }[]
  locations: readonly { id: string }[]
  equipment: readonly { id: string }[]
  assignees: readonly { id: string }[]
}

export function scheduleEditSelectionIssue(draft: ScheduleEditDraft, options: ScheduleEditOptions): string | null {
  if (!options.templates.some((row) => row.id === draft.templateId)) return 'Выберите доступный шаблон обхода'
  if (!options.locations.some((row) => row.id === draft.locationId)) return 'Выберите доступную точку'
  if (draft.equipmentId && !options.equipment.some((row) => row.id === draft.equipmentId)) {
    return 'Выбранное оборудование недоступно на этой точке. Выберите другое или «Без оборудования»'
  }
  if (draft.assignedToUserId && !options.assignees.some((row) => row.id === draft.assignedToUserId)) {
    return 'Назначенный техник недоступен на этой точке. Выберите другого или «Без назначения»'
  }
  return null
}
