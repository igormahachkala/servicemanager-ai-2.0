import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import * as api from '../lib/api'
import { locationCardPath } from '../lib/equipmentCard'
import { readOutboundScopeFromSearch } from '../lib/locationCardSections'
import { INSPECTION_ITEM_STATUS_LABELS_RU } from '../lib/enumLabelsRu'
import {
  buildPlanFact,
  completedTiming,
  PLAN_FACT_COVERAGE,
  PLAN_FACT_LIMIT,
  planFactDate,
  planFactOptions,
  planFactPeriod,
  planFactPerson,
  loadPlanFact,
  scopePlanFact,
  type PlanFactData,
  type PlanFactFilter,
} from '../lib/inspectionPlanFact'
import { PlanFactTickets } from '../components/inspection/PlanFactTickets'
import { refreshPlanFactData } from '../lib/inspectionPlanFactTickets'

const EMPTY: PlanFactData = {
  schedules: [],
  overdueSchedules: [],
  completed: [],
  active: [],
}

export function InspectionPlanFactResults(props: {
  data: PlanFactData
  filter: PlanFactFilter
  loading: boolean
  failed: boolean
  sourceAtLimit?: boolean
  me?: api.Me
  outboundScope: api.TicketScopeParams
}) {
  const [expanded, setExpanded] = useState('')
  const model = buildPlanFact(props.data, props.filter)
  const href = (path: string) =>
    api.appendScopeToPath(path, props.outboundScope)
  if (props.loading) return <p role="status">Загружаем план и факт…</p>
  // После неуспешного обновления старые данные не выдаются за актуальный результат.
  if (props.failed)
    return (
      <div role="alert" className="alert">
        Не удалось загрузить план/факт. Данные не показаны; повторите
        обновление.
      </div>
    )
  function renderRun(run: api.InspectionRunListItem) {
    const timing = completedTiming(run)
    return (
      <article className="card" key={run.id}>
        <div className="row">
          <strong>{run.title}</strong>
          <Link to={href(`/inspection/runs/${encodeURIComponent(run.id)}`)}>
            Открыть обход
          </Link>
        </div>
        <p className="muted small">
          <Link to={locationCardPath(run.location.id, props.outboundScope)}>
            {run.location.name}
          </Link>
          {run.equipment ? ` · ${run.equipment.name}` : ''}
        </p>
        <div className="inspectionRunMetaGrid">
          <div>
            Фактический исполнитель: <b>{planFactPerson(run.performedBy)}</b>
          </div>
          <div>Плановый срок в записи: {planFactDate(run.dueAt)}</div>
          <div>Начат: {planFactDate(run.createdAt)}</div>
          <div>Завершён: {planFactDate(run.completedAt)}</div>
        </div>
        {run.status === 'COMPLETED' ? (
          <p className="small">
            {timing === 'late'
              ? 'Завершён с просрочкой относительно сохранённого льготного срока.'
              : timing === 'on-time'
                ? 'Завершён в пределах сохранённого льготного срока.'
                : 'Своевременность неизвестна: нет надёжного снимка срока.'}
          </p>
        ) : null}
        <p>
          Выявлено проблем:{' '}
          <b>{run.summary.issueCount + run.summary.criticalCount}</b> · Связей с
          заявками: <b>{run.summary.createdTicketsCount}</b>
        </p>
        {(run.findings || []).map((finding) => (
          <div key={finding.id} className="small">
            {finding.title} — {INSPECTION_ITEM_STATUS_LABELS_RU[finding.status]}
            {finding.ticketId
              ? ' · Есть связь с заявкой'
              : ' · Связанная заявка не зафиксирована'}
          </div>
        ))}
        {props.me &&
        (run.findings || []).some((finding) => finding.ticketId) ? (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="ghost"
              aria-expanded={expanded === run.id}
              onClick={() => setExpanded(expanded === run.id ? '' : run.id)}
            >
              {expanded === run.id
                ? 'Скрыть заявки'
                : 'Проверить связанные заявки'}
            </button>
            {expanded === run.id ? (
              <PlanFactTickets
                run={run}
                me={props.me}
                outboundScope={props.outboundScope}
              />
            ) : null}
          </div>
        ) : null}
      </article>
    )
  }
  return (
    <div>
      {props.sourceAtLimit || model.possiblyTruncated ? (
        <p role="status" className="alert">
          Достигнут лимит выборки. Сузьте объект, сотрудника или период; итоги
          ниже могут быть неполными.
        </p>
      ) : null}
      <div className="panel">
        <b>В показанной выборке:</b> текущих планов {model.plans.length};
        просрочено {model.overdueCount}, из них начато{' '}
        {model.overdueStartedCount}; завершено в периоде{' '}
        {model.completed.length}, из них с подтверждённой просрочкой{' '}
        {model.lateCount}; незавершённых сейчас {model.active.length}.
      </div>
      <section className="panel" aria-label="Текущий план">
        <h3>Текущий план — сроки в выбранном периоде и все просроченные</h3>
        <p className="muted small">
          Только ближайший визит активного плана. Просроченный визит показан при
          любом периоде, пока обход по нему не завершён. Назначение сотрудника —
          текущее, не исторический снимок.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {model.plans.map(({ plan, run, label }) => (
            <article className="card" key={plan.id}>
              <div className="row">
                <strong>{plan.name}</strong>
                <span className="tag">{label}</span>
              </div>
              <p>
                <Link
                  to={locationCardPath(plan.location.id, props.outboundScope)}
                >
                  {plan.location.name}
                </Link>
                {plan.equipment ? ` · ${plan.equipment.name}` : ''}
              </p>
              <div>
                Срок: {planFactDate(plan.nextDueAt)} · Назначен сейчас:{' '}
                <b>{planFactPerson(plan.assignedTo)}</b>
              </div>
              {run ? (
                <Link
                  to={href(`/inspection/runs/${encodeURIComponent(run.id)}`)}
                >
                  Исполнение этого визита
                </Link>
              ) : (
                <p className="muted small">
                  Запуск для этого срока в выборке не найден. Это не
                  доказательство отсутствия выполнения.
                </p>
              )}
            </article>
          ))}
          {!model.plans.length ? (
            <p>Текущих планов в загруженной выборке по этим фильтрам нет.</p>
          ) : null}
        </div>
      </section>
      <section className="panel" aria-label="Завершённый факт">
        <h3>Факт — завершённые в выбранном периоде</h3>
        <p className="muted small">
          Период по времени завершения, а не начала. Плановый срок взят из
          самого обхода; текущий назначенный сотрудник не подставляется в
          историю.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {model.completed.map(renderRun)}
        </div>
        {!model.completed.length ? (
          <p>Завершённых обходов в загруженной выборке по этим фильтрам нет.</p>
        ) : null}
      </section>
      <section className="panel" aria-label="Незавершённый факт">
        <h3>Факт — начатые и незавершённые сейчас</h3>
        <p className="muted small">
          Без фильтра периода; объект и фактический исполнитель учитываются.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {model.active.map(renderRun)}
        </div>
        {!model.active.length ? (
          <p>
            Незавершённых обходов в загруженной выборке по этим фильтрам нет.
          </p>
        ) : null}
      </section>
    </div>
  )
}

export function InspectionPlanFactPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const outboundScope = readOutboundScopeFromSearch(search)
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>(
    {},
  )
  const labelScope = JSON.stringify([
    meQ.data?.id,
    meQ.data?.companyId,
    meQ.data?.role,
    outboundScope,
  ])
  const [today] = useState(() => new Date())
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const filter: PlanFactFilter = {
    locationId: search.get('locationId') || '',
    employeeId: search.get('employeeId') || '',
    from: search.get('from') ?? `${month}-01`,
    to:
      search.get('to') ??
      `${month}-${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}`,
  }
  const invalid = planFactPeriod(filter.from, filter.to).invalid
  const query = useQuery({
    queryKey: [
      'inspection-plan-fact',
      meQ.data?.id,
      meQ.data?.companyId,
      meQ.data?.role,
      outboundScope,
      filter,
    ],
    enabled: !!meQ.data && !invalid,
    queryFn: () => loadPlanFact(filter),
    retry: false,
  })
  const data = scopePlanFact(
    query.isError || meQ.isError ? EMPTY : query.data || EMPTY,
    outboundScope.companyId || outboundScope.linkedClientCompanyId || '',
  )
  const options = planFactOptions(data)
  const labels = query.isError || meQ.isError ? {} : selectedLabels
  const path = (target: string) => {
    const url = api.appendScopeToPath(target, outboundScope)
    return filter.locationId
      ? `${url}${url.includes('?') ? '&' : '?'}locationId=${encodeURIComponent(filter.locationId)}`
      : url
  }
  function patch(key: keyof PlanFactFilter, value: string, label?: string) {
    if (label && value)
      setSelectedLabels((previous) => ({
        ...previous,
        [`${labelScope}:${key}:${value}`]: label,
      }))
    const next = new URLSearchParams(search)
    next.set(key, value)
    setSearch(next)
  }
  return (
    <div>
      <div className="row">
        <div>
          <h2>План/факт обходов</h2>
          <p className="muted">
            По объекту и сотруднику, только в доступном контуре обходов.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to={path('/inspection/schedules')}>Планирование</Link>
          <Link to={path('/inspection/runs')}>История обходов</Link>
        </div>
      </div>
      <p className="panel">{PLAN_FACT_COVERAGE}</p>
      <div className="panel">
        <div className="inspectionRunsFilters">
          <label>
            Объект
            <select
              value={filter.locationId}
              onChange={(event) =>
                patch(
                  'locationId',
                  event.target.value,
                  event.target.selectedOptions[0]?.text,
                )
              }
            >
              <option value="">Все доступные объекты</option>
              {filter.locationId &&
              !options.locations.some(([id]) => id === filter.locationId) ? (
                <option value={filter.locationId}>
                  {labels[`${labelScope}:locationId:${filter.locationId}`] ||
                    'Выбранный объект'}
                </option>
              ) : null}
              {options.locations.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сотрудник
            <select
              value={filter.employeeId}
              onChange={(event) =>
                patch(
                  'employeeId',
                  event.target.value,
                  event.target.selectedOptions[0]?.text,
                )
              }
            >
              <option value="">Все сотрудники из доступных записей</option>
              {filter.employeeId &&
              !options.employees.some(([id]) => id === filter.employeeId) ? (
                <option value={filter.employeeId}>
                  {labels[`${labelScope}:employeeId:${filter.employeeId}`] ||
                    'Выбранный сотрудник'}
                </option>
              ) : null}
              {options.employees.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Период с
            <input
              type="date"
              value={filter.from}
              onChange={(event) => patch('from', event.target.value)}
            />
          </label>
          <label>
            Период по
            <input
              type="date"
              value={filter.to}
              onChange={(event) => patch('to', event.target.value)}
            />
          </label>
        </div>
        <p className="muted small">
          Сотрудник в плане — назначенный сейчас, в факте — фактический
          исполнитель. Даты — в часовом поясе браузера. Варианты фильтров
          берутся только из доступной выборки.
        </p>
        <button
          type="button"
          className="ghost"
          disabled={query.isFetching || invalid || !meQ.data}
          onClick={() => {
            if (meQ.data)
              void refreshPlanFactData(
                queryClient,
                () => query.refetch(),
                meQ.data,
                outboundScope,
              )
          }}
        >
          Обновить
        </button>
        {query.dataUpdatedAt && !query.isError ? (
          <span className="muted small">
            {' '}
            Снимок: {planFactDate(new Date(query.dataUpdatedAt).toISOString())}
          </span>
        ) : null}
      </div>
      {invalid ? (
        <p role="alert">
          Проверьте границы периода: начало должно быть не позже конца.
        </p>
      ) : (
        <InspectionPlanFactResults
          key={`${JSON.stringify(outboundScope)}:${JSON.stringify(filter)}`}
          sourceAtLimit={
            !!query.data &&
            Object.values(query.data).some(
              (rows) => rows.length >= PLAN_FACT_LIMIT,
            )
          }
          data={data}
          filter={filter}
          loading={!meQ.isError && (meQ.isPending || query.isPending)}
          failed={meQ.isError || query.isError}
          me={meQ.data}
          outboundScope={outboundScope}
        />
      )}
    </div>
  )
}
