import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import {
  CONTRACTOR_PERIOD_LABELS,
  contractorPeriodRange,
  contractorRoleLabel,
  fmtDurationMinutes,
  fmtSlaRatio,
  type ContractorPeriod,
  type ContractorScope,
} from '../lib/contractorAnalytics'

function fmtNumber(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('ru-RU').format(v)
}

/**
 * SMA-ANALYTICS-CONTRACTORS — блок «Подрядчики» на странице аналитики.
 *
 * Строки и их состав приходят с бэкенда уже суженными: SECONDARY получает
 * только свою организацию, сводку «не отнесено» видят клиент и PRIMARY.
 */
export function ContractorAnalyticsPanel({ scope }: { scope: ContractorScope }) {
  const [period, setPeriod] = useState<ContractorPeriod>('30d')
  const params = scope.enabled ? { ...scope.params, ...contractorPeriodRange(period) } : null

  const q = useQuery<api.ContractorAnalyticsResponse>({
    queryKey: ['analytics', 'contractors', params],
    queryFn: () => api.analyticsContractors(params ?? {}),
    enabled: !!params,
  })

  if (!scope.enabled) return null

  const contractors = q.data?.contractors ?? []

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div className="row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Подрядчики</h3>
          <div className="muted small">
            Работа засчитывается организации, только если исполнитель заявки — её сотрудник. Период — по дате создания
            заявки.
          </div>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value as ContractorPeriod)} aria-label="Период">
          {(Object.keys(CONTRACTOR_PERIOD_LABELS) as ContractorPeriod[]).map((key) => (
            <option key={key} value={key}>
              {CONTRACTOR_PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {q.isError ? <div className="alert">{(q.error as Error)?.message || String(q.error)}</div> : null}
      {q.isFetching ? <div className="muted small">Загрузка…</div> : null}
      {!q.isFetching && !q.isError && contractors.length === 0 ? (
        <div className="muted small">Нет подрядчиков с действующим договором.</div>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {contractors.map((item) => (
          <details key={item.companyId} className="card" style={{ padding: 12 }}>
            <summary style={{ cursor: 'pointer' }}>
              <span style={{ fontWeight: 700 }}>{item.name}</span>
              <span className="muted small"> · {contractorRoleLabel(item.role)}</span>
              <div className="muted small" style={{ marginTop: 4 }}>
                Выполнено: {fmtNumber(item.counters.completedTickets)} · в работе: {fmtNumber(item.counters.activeTickets)} ·
                просрочено: {fmtNumber(item.counters.overdueTickets)} · ждут закрытия:{' '}
                {fmtNumber(item.counters.awaitingClosureTickets)} · SLA: {fmtSlaRatio(item.sla.withinSlaRatio)} · среднее
                выполнение: {fmtDurationMinutes(item.sla.avgResolutionMinutes)}
              </div>
            </summary>

            {item.cities.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>По городам</div>
                {item.cities.map((city) => (
                  <div key={city.cityKey} className="muted small">
                    {city.cityLabel}: заявок {fmtNumber(city.totalTickets)}, выполнено {fmtNumber(city.doneTickets)},
                    просрочено {fmtNumber(city.overdueTickets)}, SLA {fmtSlaRatio(city.sla.withinSlaRatio)}
                  </div>
                ))}
              </div>
            ) : null}

            {item.locations.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>По объектам</div>
                {item.locations.map((location) => (
                  <div key={location.locationId} className="muted small">
                    {location.locationName || location.locationId}
                    {location.city ? `, ${location.city}` : ''}: заявок {fmtNumber(location.totalTickets)}, выполнено{' '}
                    {fmtNumber(location.completedTickets)}, в работе {fmtNumber(location.activeTickets)}, просрочено{' '}
                    {fmtNumber(location.overdueTickets)}, среднее выполнение{' '}
                    {fmtDurationMinutes(location.sla.avgResolutionMinutes)}
                  </div>
                ))}
              </div>
            ) : null}
          </details>
        ))}
      </div>

      {q.data?.unattributed ? (
        <div className="muted small" style={{ marginTop: 10 }}>
          Без подрядчика (штат или не назначены): {fmtNumber(q.data.unattributed.totalTickets)}, из них в работе{' '}
          {fmtNumber(q.data.unattributed.activeTickets)}
        </div>
      ) : null}
    </div>
  )
}
