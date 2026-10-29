import type {
  InspectionRunListItem,
  InspectionRunPerson,
  InspectionRunsFilter,
  InspectionSchedule,
  InspectionScheduleFilters,
} from './api'

export const PLAN_FACT_LIMIT = 200
export const PLAN_FACT_COVERAGE =
  'Наблюдаемый план/факт, не полный архив: до 200 записей в каждой выборке, доступ дополнительно ограничен сервером. Пропущенные незапущенные повторения не сохраняются и здесь не восстанавливаются. Процент выполнения не рассчитывается.'

export type PlanFactFilter = {
  locationId: string
  employeeId: string
  from: string
  to: string
}
export type PlanFactData = {
  schedules: InspectionSchedule[]
  completed: InspectionRunListItem[]
  active: InspectionRunListItem[]
}

function instant(value?: string | null): number | null {
  if (!value) return null
  const n = new Date(value).getTime()
  return Number.isFinite(n) ? n : null
}

export function planFactPeriod(from: string, to: string) {
  const boundary = (value: string, end: boolean): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`)
    // Date нормализует 31 февраля в март. Не отправлять такое окно на сервер.
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    )
      return null
    return Number.isFinite(date.getTime()) ? date.getTime() : null
  }
  const start = from ? boundary(from, false) : null
  const end = to ? boundary(to, true) : null
  const invalid =
    (!!from && start === null) ||
    (!!to && end === null) ||
    (start !== null && end !== null && start > end)
  return { start, end, invalid }
}

export function planFactQueries(filter: PlanFactFilter): {
  schedules: InspectionScheduleFilters
  completed: InspectionRunsFilter
  active: InspectionRunsFilter
} {
  const period = planFactPeriod(filter.from, filter.to)
  if (period.invalid) throw new Error('Проверьте границы периода')
  const from =
    period.start === null ? undefined : new Date(period.start).toISOString()
  const to =
    period.end === null ? undefined : new Date(period.end).toISOString()
  const locationId = filter.locationId || undefined
  const performedByUserId = filter.employeeId || undefined
  return {
    schedules: {
      active: true,
      locationId,
      assignedToUserId: performedByUserId,
      from,
      to,
    },
    completed: {
      status: 'COMPLETED',
      locationId,
      performedByUserId,
      completedFrom: from,
      completedTo: to,
      limit: PLAN_FACT_LIMIT,
    },
    active: {
      status: 'IN_PROGRESS',
      locationId,
      performedByUserId,
      limit: PLAN_FACT_LIMIT,
    },
  }
}

function unique<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

export function planFactPerson(person?: InspectionRunPerson | null) {
  if (!person) return 'Не указан'
  return (
    [person.lastName, person.firstName].filter(Boolean).join(' ').trim() ||
    'Сотрудник без имени'
  )
}

export function planFactDate(value?: string | null) {
  return instant(value) === null
    ? 'Не зафиксировано'
    : new Date(value!).toLocaleString('ru-RU')
}

/** Сужение отображения, не resolver доступа: исходные записи уже разрешены API. */
export function scopePlanFact(
  data: PlanFactData,
  ownerCompanyId: string,
): PlanFactData {
  const visible = <T extends { location: { clientCompanyId?: string } }>(
    rows: T[],
  ) =>
    ownerCompanyId
      ? rows.filter((row) => row.location.clientCompanyId === ownerCompanyId)
      : rows
  return {
    schedules: visible(data.schedules),
    completed: visible(data.completed),
    active: visible(data.active),
  }
}

export function planFactOptions(data: PlanFactData) {
  const locations = new Map<string, string>()
  const employees = new Map<string, string>()
  for (const row of [...data.schedules, ...data.completed, ...data.active])
    locations.set(row.location.id, row.location.name)
  for (const row of data.schedules)
    if (row.assignedTo)
      employees.set(row.assignedTo.id, planFactPerson(row.assignedTo))
  for (const row of [...data.completed, ...data.active])
    if (row.performedBy)
      employees.set(row.performedBy.id, planFactPerson(row.performedBy))
  const sorted = (map: Map<string, string>) =>
    [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'))
  return { locations: sorted(locations), employees: sorted(employees) }
}

export function completedTiming(
  run: InspectionRunListItem,
): 'late' | 'on-time' | 'unknown' {
  const completed = instant(run.completedAt)
  // Не подменять отсутствующий снимок льготного срока текущими настройками плана.
  const deadline = instant(run.overdueAt)
  if (run.status !== 'COMPLETED' || completed === null || deadline === null)
    return 'unknown'
  return completed > deadline ? 'late' : 'on-time'
}

export function buildPlanFact(
  data: PlanFactData,
  filter: PlanFactFilter,
  now: number,
) {
  const period = planFactPeriod(filter.from, filter.to)
  const inPeriod = (value?: string | null) => {
    const at = instant(value)
    return (
      !period.invalid &&
      at !== null &&
      (period.start === null || at >= period.start) &&
      (period.end === null || at <= period.end)
    )
  }
  const locationMatches = (row: { location: { id: string } }) =>
    !filter.locationId || row.location.id === filter.locationId
  const performerMatches = (run: InspectionRunListItem) =>
    !filter.employeeId || run.performedBy?.id === filter.employeeId
  const completed = unique(data.completed).filter(
    (run) =>
      run.status === 'COMPLETED' &&
      locationMatches(run) &&
      performerMatches(run) &&
      inPeriod(run.completedAt),
  )
  const completedIds = new Set(
    data.completed
      .filter((run) => run.status === 'COMPLETED')
      .map((run) => run.id),
  )
  const active = unique(data.active).filter(
    (run) =>
      run.status === 'IN_PROGRESS' &&
      !completedIds.has(run.id) &&
      locationMatches(run) &&
      performerMatches(run),
  )
  // Сопоставление визита не зависит от фильтра фактического исполнителя:
  // другой сотрудник вправе выполнить текущее назначение. История не переписывается.
  const runs = unique([...data.active, ...data.completed])
  const plans = unique(data.schedules)
    .filter(
      (plan) =>
        plan.isActive &&
        locationMatches(plan) &&
        (!filter.employeeId || plan.assignedTo?.id === filter.employeeId) &&
        inPeriod(plan.nextDueAt),
    )
    .map((plan) => {
      const due = instant(plan.nextDueAt)
      // scheduleId сам по себе недостаточен: вчерашний обход не закрывает завтрашний визит.
      // После переноса на другую точку старая запись также не становится фактом новой точки.
      const run = runs.find(
        (candidate) =>
          candidate.scheduleId === plan.id &&
          !!plan.location.clientCompanyId &&
          candidate.location.id === plan.location.id &&
          candidate.location.clientCompanyId ===
            plan.location.clientCompanyId &&
          (candidate.equipment?.id || null) === (plan.equipment?.id || null) &&
          due !== null &&
          instant(candidate.dueAt) === due,
      )
      const deadline = instant(plan.overdueAt)
      const deadlinePassed =
        deadline === null ? plan.isOverdue === true : now > deadline
      // Фильтр фактического исполнителя и лимит могут скрыть выполнение другим
      // человеком. Истёкший срок без совпавшего факта — не доказанная просрочка.
      const overdue = deadlinePassed && run?.status === 'IN_PROGRESS'
      const unconfirmed = deadlinePassed && !run
      return {
        plan,
        run,
        overdue,
        unconfirmed,
        label:
          run?.status === 'COMPLETED'
            ? 'Есть завершённый обход'
            : overdue
              ? 'В процессе · просрочен'
              : unconfirmed
                ? 'Срок прошёл · факт не подтверждён'
                : run
                  ? 'В процессе'
                  : 'План · факт не подтверждён',
      }
    })
  return {
    plans,
    completed,
    active,
    overdueCount: plans.filter((row) => row.overdue).length,
    unconfirmedCount: plans.filter((row) => row.unconfirmed).length,
    lateCount: completed.filter((run) => completedTiming(run) === 'late')
      .length,
    possiblyTruncated: Object.values(data).some(
      (rows) => rows.length >= PLAN_FACT_LIMIT,
    ),
  }
}
