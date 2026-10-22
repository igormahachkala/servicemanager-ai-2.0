import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import * as api from '../lib/api'
import { ApiRequestError } from '../lib/api'
import { readOutboundScopeFromSearch } from '../lib/locationCardSections'
import {
  EMPTY_FILTERS,
  GROUPING_LABEL,
  STATUS_OPTIONS,
  KIND_LABEL,
  VIEW_LABEL,
  activeFilterCount,
  anchorFromSearch,
  applyFilters,
  browserTimeZone,
  buildEmployeeRows,
  buildLocationRows,
  calendarRange,
  capabilityNotices,
  dayColumnLabel,
  dayKey,
  dueChipLabel,
  dueFullLabel,
  eventLinks,
  frequencyLabel,
  isServerOverdue,
  parseDayKey,
  rangeTitle,
  shiftAnchor,
  splitByTiming,
  employeeSublabel,
  filterParams,
  isCompletedStatus,
  statusLabel,
  statusOptionLabel,
  truncatedNotice,
  type CalendarFilters,
  type CalendarGrouping,
  type CalendarRow,
  type CalendarView,
} from '../lib/workCalendar'
import {
  WorkCalendarContractError,
  assertResponseMatchesRequest,
  getWorkCalendar,
  parseWorkCalendarResponse,
  type WorkCalendarEvent,
  type WorkCalendarEventKind,
  type WorkCalendarParams,
  type WorkCalendarResponse,
} from '../lib/workCalendarApi'
import './workCalendar.css'

/** Сколько отметок показывать в ячейке дня до «ещё N». */
const CELL_LIMIT = 4

function errorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) return 'Календарь работ ещё не подключён на сервере.'
    if (error.status === 403) return 'Нет доступа к календарю работ.'
    if (error.status === 400) return `Сервер отклонил запрос календаря: ${error.message}`
  }
  if (error instanceof WorkCalendarContractError) {
    return `${error.message}. Календарь не показан, чтобы не выдать неполные данные за полные.`
  }
  return error instanceof Error ? error.message : String(error)
}

type Option = { value: string; label: string; disabled?: boolean }

function MultiPicker({
  label,
  options,
  selected,
  onChange,
  searchable = false,
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (values: string[], picked: Option[]) => void
  searchable?: boolean
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options
  const toggle = (option: Option) => {
    const next = selected.includes(option.value) ? selected.filter((v) => v !== option.value) : [...selected, option.value]
    onChange(next, [option])
  }
  return (
    <details className="wcPicker">
      <summary>
        {label}
        {selected.length ? <span className="wcPickerCount">{selected.length}</span> : null}
      </summary>
      <div className="wcPickerMenu">
        {searchable ? <input type="search" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} /> : null}
        {visible.length ? (
          visible.map((option) => (
            <label key={option.value} className={option.disabled ? 'wcDisabled' : undefined}>
              <input type="checkbox" checked={selected.includes(option.value)} disabled={option.disabled} onChange={() => toggle(option)} />
              {option.label}
            </label>
          ))
        ) : (
          <div className="muted small" style={{ padding: 6 }}>
            Нет вариантов
          </div>
        )}
        {selected.length ? (
          <button type="button" className="ghost" style={{ height: 30, marginTop: 4 }} onClick={() => onChange([], [])}>
            Сбросить
          </button>
        ) : null}
      </div>
    </details>
  )
}

function EventChip({ event, timeZone, onOpen }: { event: WorkCalendarEvent; timeZone: string; onOpen: (e: WorkCalendarEvent) => void }) {
  const overdue = isServerOverdue(event)
  const due = dueChipLabel(event, timeZone)
  return (
    <button
      type="button"
      className={`wcChip ${event.kind === 'TICKET' ? 'ticket' : 'inspection'}${overdue ? ' overdue' : ''}`}
      onClick={() => onOpen(event)}
      title={`${KIND_LABEL[event.kind] ?? event.kind}: ${event.title}`}
    >
      <span className="wcChipMeta">
        <span>{KIND_LABEL[event.kind] ?? event.kind}</span>
        {due ? <span>{due}</span> : null}
        {overdue ? <span style={{ color: '#9f1239' }}>просрочен</span> : null}
      </span>
      <span className="wcChipTitle">{event.title || 'Без названия'}</span>
    </button>
  )
}

function formatInstant(iso: string, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
  try {
    return new Date(iso).toLocaleString('ru-RU', { ...options, timeZone })
  } catch {
    return new Date(iso).toLocaleString('ru-RU', options)
  }
}

type Lookup = {
  employee: (id: string | null) => string
  location: (id: string | null) => { name: string; sub: string }
}

function makeLookup(data: WorkCalendarResponse | undefined): Lookup {
  const employees = new Map(
    (data?.resources.employees ?? []).map((e) => {
      const sub = employeeSublabel(e)
      return [e.id, sub ? `${e.displayName} (${sub})` : e.displayName]
    }),
  )
  const locations = new Map((data?.resources.locations ?? []).map((l) => [l.id, l]))
  return {
    employee: (id) => (id ? (employees.get(id) ?? 'Нет в списке сотрудников') : 'Не назначен'),
    location: (id) => {
      if (!id) return { name: '—', sub: '' }
      const loc = locations.get(id)
      if (!loc) return { name: 'Нет в списке объектов', sub: '' }
      return { name: loc.name, sub: [loc.city, loc.address].filter(Boolean).join(', ') }
    },
  }
}

function EventDrawer({
  event,
  timeZone,
  lookup,
  scope,
  actorCompanyId,
  onClose,
}: {
  event: WorkCalendarEvent
  timeZone: string
  lookup: Lookup
  scope: ReturnType<typeof readOutboundScopeFromSearch>
  actorCompanyId: string | null
  onClose: () => void
}) {
  const links = eventLinks(event, scope, actorCompanyId)
  const location = lookup.location(event.locationId)
  const overdue = isServerOverdue(event)
  return (
    <div className="wcBackdrop" onClick={onClose}>
      <aside className="wcDrawer" role="dialog" aria-modal="true" aria-label="Карточка события" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className={`wcKind ${event.kind === 'TICKET' ? 'ticket' : 'inspection'}`}>{KIND_LABEL[event.kind] ?? event.kind}</span>
            <span className="uiStatusBadge">{statusLabel(event.status)}</span>
            {overdue ? <span className="tag danger">Просрочен</span> : null}
          </div>
          <button type="button" className="ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <h3 style={{ margin: '8px 0 0' }}>{event.title || 'Без названия'}</h3>
        <dl>
          <dt>Срок</dt>
          <dd>{dueFullLabel(event, timeZone)}</dd>
          <dt>Время работ</dt>
          <dd className="muted">Не задано — в данных есть только срок</dd>
          <dt>Исполнитель</dt>
          <dd>{lookup.employee(event.employeeId)}</dd>
          <dt>Объект</dt>
          <dd>
            {location.name}
            {location.sub ? <div className="muted small">{location.sub}</div> : null}
          </dd>
          <dt>Источник</dt>
          <dd>{event.kind === 'INSPECTION' ? 'План обхода' : `Заявка №${event.ticket?.ticketNumber ?? '—'}`}</dd>
          {event.recurrence ? (
            <>
              <dt>Периодичность</dt>
              <dd>{frequencyLabel(event.recurrence.frequency, event.recurrence.intervalDays)}</dd>
              {event.inspection?.templateName ? (
                <>
                  <dt>Шаблон</dt>
                  <dd>{event.inspection.templateName}</dd>
                </>
              ) : null}
              <dt>Следующий визит</dt>
              <dd>{event.recurrence.followingDueAt ? formatInstant(event.recurrence.followingDueAt, timeZone) : '—'}</dd>
            </>
          ) : null}
        </dl>
        <div className="wcDrawerLinks">
          {links.primary ? (
            <Link className="primary" to={links.primary.to}>
              {links.primary.label}
            </Link>
          ) : null}
          {links.lastRun ? <Link to={links.lastRun}>Последний обход</Link> : null}
          {links.location ? <Link to={links.location}>Карточка объекта</Link> : null}
        </div>
        <p className="muted small" style={{ marginTop: 16 }}>
          Календарь только для просмотра: исполнителя, дату и статус меняют в заявке или плане обходов.
        </p>
      </aside>
    </div>
  )
}

function CellListDrawer({
  title,
  events,
  timeZone,
  onOpen,
  onClose,
}: {
  title: string
  events: WorkCalendarEvent[]
  timeZone: string
  onOpen: (e: WorkCalendarEvent) => void
  onClose: () => void
}) {
  return (
    <div className="wcBackdrop" onClick={onClose}>
      <aside className="wcDrawer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="wcCellList" style={{ marginTop: 12 }}>
          {events.map((event) => (
            <EventChip key={event.id} event={event} timeZone={timeZone} onOpen={onOpen} />
          ))}
        </div>
      </aside>
    </div>
  )
}

function ResourceGrid({
  rows,
  days,
  view,
  timeZone,
  emptyText,
  onOpen,
  onOpenCell,
}: {
  rows: CalendarRow[]
  days: string[]
  view: CalendarView
  timeZone: string
  emptyText: string
  onOpen: (e: WorkCalendarEvent) => void
  onOpenCell: (title: string, events: WorkCalendarEvent[]) => void
}) {
  const today = dayKey(new Date())
  const compact = view === 'month'
  const split = useMemo(() => rows.map((row) => ({ row, byDay: splitByTiming(row.events, days).byDay })), [rows, days])
  if (!rows.length) return <div className="panel muted">{emptyText}</div>
  const colWidth = compact ? 44 : view === 'week' ? 120 : undefined
  return (
    <div className="wcGridWrap">
      <table className="wcGrid" style={colWidth ? { minWidth: 220 + days.length * colWidth } : undefined}>
        <thead>
          <tr>
            <th className="wcRowHead" />
            {days.map((key) => {
              const label = dayColumnLabel(key)
              return (
                <th key={key} className={key === today ? 'wcToday' : undefined}>
                  {compact ? (
                    <>
                      <div>{parseDayKey(key).getDate()}</div>
                      <div style={{ fontWeight: 400 }}>{label.weekday}</div>
                    </>
                  ) : (
                    `${label.weekday}, ${label.day}`
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {split.map(({ row, byDay }) => {
            const special = row.kind !== 'employee' && row.kind !== 'location'
            const scheduledCount = [...byDay.values()].reduce((sum, list) => sum + list.length, 0)
            const unscheduledCount = row.events.length - scheduledCount
            return (
              <tr key={row.key}>
                <th className={`wcRowHead${special ? ' wcSpecial' : ''}`} scope="row">
                  <div className="wcRowLabel">{row.label}</div>
                  {row.sublabel ? <div className="wcRowSub">{row.sublabel}</div> : null}
                  {row.events.length === 0 ? (
                    <div className="wcRowEmpty">Нет работ в периоде</div>
                  ) : unscheduledCount > 0 ? (
                    <div className="wcRowSub">Без даты: {unscheduledCount}</div>
                  ) : null}
                </th>
                {days.map((key) => {
                  const list = byDay.get(key) ?? []
                  const weekday = parseDayKey(key).getDay()
                  const cls = key === today ? 'wcToday' : weekday === 0 || weekday === 6 ? 'wcWeekend' : undefined
                  const cellTitle = `${row.label} — ${parseDayKey(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
                  if (compact) {
                    return (
                      <td key={key} className={cls}>
                        {list.length ? (
                          <button
                            type="button"
                            className={`wcCount${list.some(isServerOverdue) ? ' overdue' : ''}`}
                            onClick={() => onOpenCell(cellTitle, list)}
                            aria-label={`${cellTitle}: работ ${list.length}`}
                          >
                            {list.length}
                          </button>
                        ) : null}
                      </td>
                    )
                  }
                  const limit = view === 'day' ? list.length : CELL_LIMIT
                  return (
                    <td key={key} className={cls}>
                      <div className="wcCellList">
                        {list.slice(0, limit).map((event) => (
                          <EventChip key={event.id} event={event} timeZone={timeZone} onOpen={onOpen} />
                        ))}
                        {list.length > limit ? (
                          <button type="button" className="ghost wcMore" onClick={() => onOpenCell(cellTitle, list)}>
                            ещё {list.length - limit}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EventTable({
  events,
  timeZone,
  lookup,
  groupByDay,
  onOpen,
}: {
  events: WorkCalendarEvent[]
  timeZone: string
  lookup: Lookup
  groupByDay?: Map<string, WorkCalendarEvent[]>
  onOpen: (e: WorkCalendarEvent) => void
}) {
  const renderRow = (event: WorkCalendarEvent) => {
    const location = lookup.location(event.locationId)
    return (
      <tr key={event.id}>
        <td style={{ whiteSpace: 'nowrap' }}>{dueFullLabel(event, timeZone)}</td>
        <td>
          <span className={`wcKind ${event.kind === 'TICKET' ? 'ticket' : 'inspection'}`}>{KIND_LABEL[event.kind] ?? event.kind}</span>
        </td>
        <td>
          <button type="button" className="wcLinkButton" onClick={() => onOpen(event)}>
            {event.title || 'Без названия'}
          </button>
          {isServerOverdue(event) ? (
            <span className="tag danger" style={{ marginLeft: 6 }}>
              Просрочен
            </span>
          ) : null}
        </td>
        <td>{statusLabel(event.status)}</td>
        <td>{lookup.employee(event.employeeId)}</td>
        <td>{location.name}</td>
      </tr>
    )
  }
  return (
    <div className="wcGridWrap">
      <table className="wcList">
        <thead>
          <tr>
            <th>Срок</th>
            <th>Тип</th>
            <th>Работа</th>
            <th>Статус</th>
            <th>Исполнитель</th>
            <th>Объект</th>
          </tr>
        </thead>
        <tbody>
          {groupByDay
            ? [...groupByDay.entries()].map(([key, list]) => [
                <tr key={`day:${key}`} className="wcDayRow">
                  <td colSpan={6}>{parseDayKey(key).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</td>
                </tr>,
                ...list.map(renderRow),
              ])
            : events.map(renderRow)}
        </tbody>
      </table>
    </div>
  )
}

export function WorkCalendarPage() {
  const [searchParams] = useSearchParams()
  const scopeKey = searchParams.toString()
  const scope = useMemo(() => readOutboundScopeFromSearch(new URLSearchParams(scopeKey)), [scopeKey])
  // Contract fixture бэкенда вместо сервера — только в dev-сборке и только по явному ?mock=<случай>.
  const mockMode = import.meta.env.DEV ? searchParams.get('mock') : null
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const actorCompanyId = meQ.data?.companyId ?? null

  const [view, setView] = useState<CalendarView>('week')
  const [grouping, setGrouping] = useState<CalendarGrouping>('employees')
  const [anchor, setAnchor] = useState(() => anchorFromSearch(searchParams.get('date')) ?? new Date())
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [showEmpty, setShowEmpty] = useState(true)
  const [openEvent, setOpenEvent] = useState<WorkCalendarEvent | null>(null)
  const [openCell, setOpenCell] = useState<{ title: string; events: WorkCalendarEvent[] } | null>(null)

  const timeZone = useMemo(() => browserTimeZone(), [])
  const range = useMemo(() => calendarRange(view, anchor), [view, anchor])

  // Только параметры контроллера #453 (4ba0e242).
  const params: WorkCalendarParams = useMemo(
    () => ({
      from: range.days[0],
      to: dayKey(range.to),
      timezone: timeZone,
      ...filterParams(filters),
      ...scope,
    }),
    [range, timeZone, filters, scope],
  )
  const expectedFromIso = range.from.toISOString()

  const calendarQ = useQuery({
    queryKey: ['work-calendar', params, mockMode],
    queryFn: async () => {
      if (import.meta.env.DEV && mockMode) {
        // ?mock=v1 — эталон бэкенда, остальное — сценарии того же сервиса.
        const [canonical, scenarios] = await Promise.all([
          import('../lib/__fixtures__/work-calendar.response.v1.json'),
          import('../lib/__fixtures__/workCalendar.scenarios.json'),
        ])
        const cases = (scenarios.default as { cases: Record<string, { response: unknown }> }).cases
        const raw = mockMode === 'v1' ? canonical.default : cases[mockMode]?.response
        if (!raw) throw new Error(`Нет случая ?mock=${mockMode}. Есть: v1, ${Object.keys(cases).join(', ')}`)
        const response = parseWorkCalendarResponse(structuredClone(raw))
        assertResponseMatchesRequest(response, params, expectedFromIso)
        return response
      }
      return getWorkCalendar(params, expectedFromIso)
    },
    placeholderData: keepPreviousData,
    retry: (count, error) =>
      !(error instanceof WorkCalendarContractError) &&
      !(error instanceof ApiRequestError && [400, 403, 404].includes(error.status)) &&
      count < 2,
  })

  useEffect(() => {
    if (!openEvent && !openCell) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (openEvent) setOpenEvent(null)
      else setOpenCell(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openEvent, openCell])

  const data = calendarQ.data
  const lookup = useMemo(() => makeLookup(data), [data])
  const displayZone = data?.range.timezone || timeZone
  const events = useMemo(() => applyFilters(data?.events ?? [], filters), [data, filters])
  const split = useMemo(() => splitByTiming(events, range.days), [events, range.days])
  const rows = useMemo(() => {
    if (!data) return []
    if (grouping === 'employees') return buildEmployeeRows(data, events, { filters, showEmpty })
    if (grouping === 'locations') return buildLocationRows(data, events, { filters, showEmpty })
    return []
  }, [data, events, filters, grouping, showEmpty])

  const employeeOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const emp of data?.resources.employees ?? []) options.set(emp.id, emp.displayName || 'Без имени')
    for (const id of filters.employeeIds) if (!options.has(id)) options.set(id, labels[id] ?? 'Выбранный сотрудник')
    return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [data, filters.employeeIds, labels])
  const locationOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const loc of data?.resources.locations ?? [])
      options.set(loc.id, [loc.name, loc.city].filter(Boolean).join(' · ') || 'Без названия')
    for (const id of filters.locationIds) if (!options.has(id)) options.set(id, labels[id] ?? 'Выбранный объект')
    return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [data, filters.locationIds, labels])
  const typeOptions: Option[] = [
    { value: 'TICKET', label: 'Заявки', disabled: data ? !data.capabilities.tickets : false },
    { value: 'INSPECTION', label: 'Обходы', disabled: data ? !data.capabilities.inspections : false },
  ]
  // Завершённые без флага сервер не вернёт — выбирать их можно только с галкой.
  const statusChoices = STATUS_OPTIONS.map((value) => ({
    value,
    label: statusOptionLabel(value),
    disabled: isCompletedStatus(value) && !filters.includeCompleted,
  }))

  const patchFilters = (patch: Partial<CalendarFilters>) => setFilters((prev) => ({ ...prev, ...patch }))
  const rememberLabels = (picked: Option[]) =>
    setLabels((prev) => ({ ...prev, ...Object.fromEntries(picked.map((o) => [o.value, o.label])) }))

  const notices = data ? capabilityNotices(data.capabilities) : []
  const truncated = data ? truncatedNotice(data.meta) : null
  const filterCount = activeFilterCount(filters)

  return (
    <div className="managementPage">
      <div className="managementPageContext">
        <div className="row">
          <div>
            <h2 style={{ marginBottom: 4 }}>Календарь работ</h2>
            <div className="muted small">
              Заявки по плановой дате и обходы по сроку графика. Только просмотр: время начала и длительность в данных не заданы.
            </div>
          </div>
        </div>

        <div className="wcToolbar">
          <div className="wcSeg" role="group" aria-label="Период">
            {(Object.keys(VIEW_LABEL) as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? undefined : 'ghost'}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
          <div className="wcSeg">
            <button
              type="button"
              className="ghost"
              aria-label="Предыдущий период"
              onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}
            >
              ‹
            </button>
            <button type="button" className="ghost" onClick={() => setAnchor(new Date())}>
              Сегодня
            </button>
            <button type="button" className="ghost" aria-label="Следующий период" onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}>
              ›
            </button>
          </div>
          <span className="wcRangeTitle">{rangeTitle(range)}</span>
          {calendarQ.isFetching ? <span className="muted small">Обновление…</span> : null}
          <span className="wcSpacer" />
          <span className="muted small">Часовой пояс: {displayZone}</span>
        </div>

        <div className="wcToolbar">
          <div className="wcSeg" role="group" aria-label="Представление">
            {(Object.keys(GROUPING_LABEL) as CalendarGrouping[]).map((g) => (
              <button
                key={g}
                type="button"
                className={grouping === g ? undefined : 'ghost'}
                aria-pressed={grouping === g}
                onClick={() => setGrouping(g)}
              >
                {GROUPING_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        <div className="wcFilters">
          <MultiPicker
            label="Сотрудники"
            searchable
            options={employeeOptions}
            selected={filters.employeeIds}
            onChange={(values, picked) => {
              rememberLabels(picked)
              patchFilters({ employeeIds: values })
            }}
          />
          <MultiPicker
            label="Объекты"
            searchable
            options={locationOptions}
            selected={filters.locationIds}
            onChange={(values, picked) => {
              rememberLabels(picked)
              patchFilters({ locationIds: values })
            }}
          />
          <MultiPicker
            label="Типы"
            options={typeOptions}
            selected={filters.eventTypes}
            onChange={(values) => patchFilters({ eventTypes: values as WorkCalendarEventKind[] })}
          />
          <MultiPicker
            label="Статусы"
            options={statusChoices}
            selected={filters.statuses}
            onChange={(values) => patchFilters({ statuses: values })}
          />
          <select
            aria-label="Назначение"
            value={filters.assigned}
            onChange={(e) => patchFilters({ assigned: e.target.value as CalendarFilters['assigned'] })}
          >
            <option value="all">Все работы</option>
            <option value="assigned">С исполнителем</option>
            <option value="unassigned">Без исполнителя</option>
          </select>
          <label className="wcCheck">
            <input
              type="checkbox"
              checked={filters.includeUnscheduled}
              onChange={(e) => patchFilters({ includeUnscheduled: e.target.checked })}
            />
            Без назначенного времени
          </label>
          <label className="wcCheck">
            <input
              type="checkbox"
              checked={filters.includeCompleted}
              onChange={(e) =>
                patchFilters(
                  e.target.checked
                    ? { includeCompleted: true }
                    : { includeCompleted: false, statuses: filters.statuses.filter((s) => !isCompletedStatus(s)) },
                )
              }
            />
            Завершённые и отменённые
          </label>
          {grouping !== 'works' ? (
            <label className="wcCheck">
              <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
              {grouping === 'employees' ? 'Сотрудники без работ' : 'Объекты без работ'}
            </label>
          ) : null}
          {filterCount ? (
            <button type="button" className="ghost" style={{ height: 34 }} onClick={() => setFilters(EMPTY_FILTERS)}>
              Сбросить фильтры
            </button>
          ) : null}
        </div>
      </div>

      <div className="wcBody">
        {mockMode ? (
          <div className="wcNotice info">Contract fixture бэкенда (?mock={mockMode}), только для разработки. Не реальные работы.</div>
        ) : null}
        {notices.map((text) => (
          <div key={text} className="wcNotice">
            {text}
          </div>
        ))}
        {truncated ? <div className="wcNotice">{truncated}</div> : null}
        {split.outside.length ? (
          <div className="wcNotice info">
            Событий с датой за границей видимых дней: {split.outside.length}. Они есть в представлении «По работам».
          </div>
        ) : null}

        {calendarQ.isError ? <div className="alert">{errorText(calendarQ.error)}</div> : null}
        {calendarQ.isLoading ? <div className="muted small">Загрузка…</div> : null}

        {data ? (
          <>
            {grouping === 'works' ? (
              split.byDay.size ? (
                <EventTable
                  events={[]}
                  timeZone={displayZone}
                  lookup={lookup}
                  groupByDay={new Map([...split.byDay.entries()].sort(([a], [b]) => a.localeCompare(b)))}
                  onOpen={setOpenEvent}
                />
              ) : (
                <div className="panel muted">В выбранном периоде нет работ со сроком.</div>
              )
            ) : (
              <ResourceGrid
                rows={rows}
                days={range.days}
                view={view}
                timeZone={displayZone}
                emptyText={grouping === 'employees' ? 'Нет сотрудников и работ для показа.' : 'Нет объектов и работ для показа.'}
                onOpen={setOpenEvent}
                onOpenCell={(title, list) => setOpenCell({ title, events: list })}
              />
            )}

            {grouping === 'works' && split.outside.length ? (
              <section className="wcSection">
                <h3>За границей периода</h3>
                <EventTable events={split.outside} timeZone={displayZone} lookup={lookup} onOpen={setOpenEvent} />
              </section>
            ) : null}

            {filters.includeUnscheduled && data.capabilities.unscheduled ? (
              <section className="wcSection">
                <h3>Без назначенного времени · {split.unscheduled.length}</h3>
                <div className="muted small" style={{ marginBottom: 8 }}>
                  Нет плановой даты: работа не стоит в календаре, пока дату не назначат в заявке или графике.
                </div>
                {split.unscheduled.length ? (
                  <EventTable events={split.unscheduled} timeZone={displayZone} lookup={lookup} onOpen={setOpenEvent} />
                ) : (
                  <div className="panel muted">Таких работ нет.</div>
                )}
              </section>
            ) : null}

            <div className="wcLegend">
              <span>
                <span className="wcKind ticket">Заявка</span> — по плановой дате
              </span>
              <span>
                <span className="wcKind inspection">Обход</span> — по сроку графика
              </span>
              <span>«срок 14:00» — крайний срок, не время начала работы</span>
            </div>
          </>
        ) : null}
      </div>

      {openCell && !openEvent ? (
        <CellListDrawer
          title={openCell.title}
          events={openCell.events}
          timeZone={displayZone}
          onOpen={setOpenEvent}
          onClose={() => setOpenCell(null)}
        />
      ) : null}
      {openEvent ? (
        <EventDrawer
          event={openEvent}
          timeZone={displayZone}
          lookup={lookup}
          scope={scope}
          actorCompanyId={actorCompanyId}
          onClose={() => setOpenEvent(null)}
        />
      ) : null}
    </div>
  )
}
