import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Link, useLocation, useSearchParams } from 'react-router-dom'

import * as api from '../lib/api'
import {
  clearLocationFilterPath,
  locationFilterChipLabel,
  readLocationFilterFromSearch,
  readOutboundScopeFromSearch,
} from '../lib/locationCardSections'
import { locationCardPath } from '../lib/equipmentCard'

/**
 * SMA-ROUNDS-V1-SCHEDULE-CRUD-098 — минимальный экран планирования обходов.
 *
 * Это не планировщик: ни календаря, ни маршрутов, ни автогенерации обходов. Менеджер
 * выбирает шаблон, точку, техника, дату и время, задаёт повторение и сохраняет план.
 * Ниже — простой список запланированного.
 */

const FREQUENCY_LABELS: Record<api.InspectionFrequency, string> = {
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

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as api.InspectionFrequency[]

/** Роли, у которых по канонической матрице есть LOCATIONS_MANAGE. Это подсказка интерфейса: решение принимает бэкенд. */
const MANAGER_ROLES = ['ADMIN', 'MASTER', 'DISPATCHER']

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return value
  }
}

function technicianLabel(user: { email: string; firstName?: string | null; lastName?: string | null }) {
  const name = [user.lastName, user.firstName].filter(Boolean).join(' ').trim()
  return name || user.email
}

/** Собирает ISO-строку из полей «Дата» и «Время» в местном времени пользователя. */
function toIsoStartDate(date: string, time: string) {
  if (!date) return ''
  const parsed = new Date(`${date}T${time || '09:00'}`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString()
}

export function InspectionSchedulesPage() {
  const qc = useQueryClient()

  const [searchParams] = useSearchParams()
  const routerLocation = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canManage = MANAGER_ROLES.includes(String(meQ.data?.role || ''))

  /*
   * SMA-LOCATION-CARD-V2: переход с карточки точки сужает план обходов до
   * этой точки. Фильтр уже поддержан API (getInspectionSchedules.locationId),
   * страница его просто не читала — ссылка открывала полный план.
   */
  const locationFilter = readLocationFilterFromSearch(searchParams)
  const schedulesQ = useQuery({
    queryKey: ['inspection-schedules', locationFilter],
    queryFn: () => api.getInspectionSchedules(locationFilter ? { locationId: locationFilter } : undefined),
  })
  const templatesQ = useQuery({ queryKey: ['inspection-templates'], queryFn: api.getInspectionTemplates, enabled: canManage })
  const linkedClientsQ = useQuery({ queryKey: ['linked-clients'], queryFn: api.getLinkedClients, enabled: canManage })

  const [clientCompanyId, setClientCompanyId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [frequency, setFrequency] = useState<api.InspectionFrequency>('ONCE')
  const [intervalDays, setIntervalDays] = useState('')
  const [error, setError] = useState('')

  /**
   * Точки принадлежат компании клиента. Для клиентской компании это её собственные точки,
   * для подрядчика — точки выбранного клиента по действующему договору.
   */
  const locationsQ = useQuery({
    queryKey: ['locations', clientCompanyId],
    queryFn: () => api.locations(clientCompanyId || undefined),
    enabled: canManage,
  })

  const clients = linkedClientsQ.data || []
  const locations = locationsQ.data || []

  const candidatesQ = useQuery({
    queryKey: ['round-assignable-technicians', locationId],
    queryFn: () => api.getAssignableRoundTechnicians(locationId),
    enabled: canManage && !!locationId,
  })
  const executors = candidatesQ.data || []

  useEffect(() => {
    if (!assignedToUserId || candidatesQ.isPending) return
    if (executors.some((candidate) => candidate.id === assignedToUserId)) return
    setAssignedToUserId('')
  }, [assignedToUserId, candidatesQ.isPending, executors])

  const createM = useMutation({
    mutationFn: async () => {
      const startDate = toIsoStartDate(date, time)
      if (!templateId) throw new Error('Выберите шаблон обхода')
      if (!locationId) throw new Error('Выберите точку')
      if (!startDate) throw new Error('Укажите дату и время')
      if (frequency === 'CUSTOM' && !Number(intervalDays)) {
        throw new Error('Для своего интервала укажите число дней')
      }

      return api.createInspectionSchedule({
        templateId,
        locationId,
        assignedToUserId: assignedToUserId || undefined,
        frequency,
        intervalDays: frequency === 'CUSTOM' ? Number(intervalDays) : undefined,
        startDate,
      })
    },
    onSuccess: () => {
      setError('')
      setTemplateId('')
      setLocationId('')
      setAssignedToUserId('')
      setDate('')
      setTime('09:00')
      setFrequency('ONCE')
      setIntervalDays('')
      qc.invalidateQueries({ queryKey: ['inspection-schedules'] })
    },
    onError: (e: any) => setError(e?.message || String(e)),
  })

  const removeM = useMutation({
    mutationFn: (id: string) => api.deleteInspectionSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection-schedules'] }),
    onError: (e: any) => setError(e?.message || String(e)),
  })

  const schedules = schedulesQ.data || []
  /* Исходящие ссылки возвращают область тем параметром, которым она пришла. */
  const outboundScope = readOutboundScopeFromSearch(searchParams)

  /*
   * Phase 2: сужение по точке должно быть ВИДНО.
   *
   * Фильтр приходит из адреса (переход с карточки точки), и без подписи
   * список выглядел полным — пользователь не понимал, почему обходов
   * меньше, и не мог снять сужение. Название берётся из доступных данных;
   * идентификатор не показывается.
   */
  const filteredLocationName =
    locations.find((row) => row.id === locationFilter)?.name
    || schedules.find((row) => row.location.id === locationFilter)?.location.name
    || ''
  const locationChip = locationFilterChipLabel({ locationId: locationFilter, locationName: filteredLocationName })
  const clearLocationFilterTo = clearLocationFilterPath(routerLocation.pathname, searchParams)

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Планирование обходов</h2>
          <div className="muted small">
            {canManage
              ? 'Запланируйте обход: шаблон, точка, техник, дата и повторение.'
              : 'Обходы, запланированные на вас.'}
          </div>
        </div>
      </div>

      {locationChip ? (
        <div className="panel" style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="tag">{locationChip}</span>
          <span className="muted small">Показаны обходы только этой точки.</span>
          <Link to={clearLocationFilterTo}>
            <button className="ghost">Показать все обходы</button>
          </Link>
          {locationFilter ? (
            <Link to={locationCardPath(locationFilter, outboundScope)}>
              <button className="ghost">Карточка точки</button>
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="alert">{error}</div> : null}
      {schedulesQ.isError ? (
        <div className="alert">{(schedulesQ.error as any)?.message || String(schedulesQ.error)}</div>
      ) : null}

      {canManage ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Запланировать обход</h3>

          <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {clients.length > 0 ? (
              <label>
                <div className="muted small">Клиент</div>
                <select
                  value={clientCompanyId}
                  onChange={(e) => {
                    setClientCompanyId(e.target.value)
                    setLocationId('')
                  }}
                >
                  <option value="">Своя компания</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.clientCompany.id}>
                      {c.clientCompany.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <div className="muted small">Шаблон обхода</div>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Не выбран</option>
                {(templatesQ.data || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label>
              <div className="muted small">Точка</div>
              <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setAssignedToUserId('') }}>
                <option value="">Не выбрана</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.city ? ` · ${l.city}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="muted small">Техник</div>
              <select
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
                disabled={!locationId || candidatesQ.isPending}
              >
                <option value="">Без назначения</option>
                {executors.map((t) => (
                  <option key={t.id} value={t.id}>{technicianLabel(t)}</option>
                ))}
              </select>
              {!locationId ? (
                <div className="muted small">Сначала выберите точку</div>
              ) : candidatesQ.isPending ? (
                <div className="muted small">Подбираем исполнителей…</div>
              ) : candidatesQ.isError ? (
                <div className="muted small">Не удалось получить список исполнителей</div>
              ) : executors.length === 0 ? (
                <div className="muted small">
                  Для этой точки нет доступных исполнителей. Проверьте договор и привязки сотрудников к точке.
                </div>
              ) : null}
            </label>

            <label>
              <div className="muted small">Дата</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label>
              <div className="muted small">Время</div>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>

            <label>
              <div className="muted small">Повторение</div>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as api.InspectionFrequency)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </label>

            {frequency === 'CUSTOM' ? (
              <label>
                <div className="muted small">Интервал, дней</div>
                <input
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={() => createM.mutate()} disabled={createM.isPending}>
              {createM.isPending ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Запланированные обходы</h3>
        {schedulesQ.isLoading ? <div className="muted">Загружаем план…</div> : null}
        {!schedulesQ.isLoading && schedules.length === 0 ? (
          <div className="muted">Пока ничего не запланировано.</div>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {schedules.map((s) => (
            <div key={s.id} className="card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <div className="muted small">
                    {s.template.name} ·{' '}
                    {/* Phase 2: из обхода — обратно в карточку точки, с сохранением области. */}
                    <Link to={locationCardPath(s.location.id, outboundScope)}>{s.location.name}</Link>
                    {s.location.city ? ` · ${s.location.city}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="tag">{FREQUENCY_LABELS[s.frequency]}</span>
                  {!s.isActive ? <span className="tag">Снят с плана</span> : null}
                  {canManage ? (
                    <button
                      className="ghost"
                      onClick={() => removeM.mutate(s.id)}
                      disabled={removeM.isPending}
                    >
                      Снять с плана
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <div className="muted small">Ближайший срок</div>
                  <div>{fmtDateTime(s.nextDueAt)}</div>
                </div>
                <div>
                  <div className="muted small">Начало</div>
                  <div>{fmtDateTime(s.startDate)}</div>
                </div>
                <div>
                  <div className="muted small">Техник</div>
                  <div>{s.assignedTo ? technicianLabel(s.assignedTo) : '—'}</div>
                </div>
                <div>
                  <div className="muted small">Интервал</div>
                  <div>{s.frequency === 'CUSTOM' && s.intervalDays ? `${s.intervalDays} дн.` : '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
