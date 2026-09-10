import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { ProtectedUploadImg } from '../ui/ProtectedUploadMedia'
import { EquipmentHistoryTab } from '../components/equipment/EquipmentHistoryTab'
import { EquipmentPartsTab } from '../components/equipment/EquipmentPartsTab'

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Реестр оборудования: список слева, карточка справа. Здесь заканчивается
 * заглушка модуля — до этого /equipment показывал только плашку «в разработке».
 *
 * Поиск и фильтры уходят на сервер: парк сети — это тысячи единиц, и отбирать
 * их в браузере значило бы сначала выгрузить туда весь чужой контур.
 */

/** Роли, у которых по канонической матрице есть LOCATIONS_MANAGE. Подсказка интерфейса: решает бэкенд. */
const MANAGER_ROLES = ['ADMIN', 'MASTER', 'DISPATCHER']

const STATUS_ORDER = ['ACTIVE', 'REPAIR', 'INACTIVE', 'DECOMMISSIONED']

type FormValue = {
  locationId: string
  name: string
  type: string
  status: string
  manufacturer: string
  model: string
  serialNumber: string
  inventoryNumber: string
  commissionedAt: string
  warrantyUntil: string
  description: string
}

const emptyForm: FormValue = {
  locationId: '',
  name: '',
  type: '',
  status: 'ACTIVE',
  manufacturer: '',
  model: '',
  serialNumber: '',
  inventoryNumber: '',
  commissionedAt: '',
  warrantyUntil: '',
  description: '',
}

function toFormValue(item: api.EquipmentListItem): FormValue {
  return {
    locationId: item.locationId || '',
    name: item.name || '',
    type: item.type || '',
    status: item.status || 'ACTIVE',
    manufacturer: item.manufacturer || '',
    model: item.model || '',
    serialNumber: item.serialNumber || '',
    inventoryNumber: item.inventoryNumber || '',
    commissionedAt: toDateInput(item.commissionedAt),
    warrantyUntil: toDateInput(item.warrantyUntil),
    description: item.description || '',
  }
}

/** Поле <input type="date"> понимает только YYYY-MM-DD. */
function toDateInput(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('ru-RU', { dateStyle: 'medium' })
}

function statusLabel(status?: string | null) {
  if (!status) return '—'
  return api.EQUIPMENT_STATUS_LABELS[status] || status
}

function locationLabel(item: api.EquipmentListItem) {
  const location = item.location
  if (!location) return '—'
  return [location.platformCode, location.name].filter(Boolean).join(' · ') || '—'
}

/** Гарантия истекла — повод для карточки, а не для отдельного отчёта. */
function warrantyExpired(item: api.EquipmentListItem) {
  if (!item.warrantyUntil) return false
  const until = new Date(item.warrantyUntil)
  return !Number.isNaN(until.getTime()) && until.getTime() < Date.now()
}

function toSaveInput(value: FormValue, mode: 'create' | 'update'): api.SaveEquipmentInput {
  const optional = (raw: string) => (mode === 'create' ? raw.trim() || undefined : raw.trim())
  return {
    ...(mode === 'create' ? { locationId: value.locationId } : {}),
    name: value.name.trim(),
    type: value.type.trim(),
    ...(mode === 'update' ? { status: value.status } : {}),
    manufacturer: optional(value.manufacturer),
    model: optional(value.model),
    serialNumber: optional(value.serialNumber),
    inventoryNumber: optional(value.inventoryNumber),
    commissionedAt: optional(value.commissionedAt),
    warrantyUntil: optional(value.warrantyUntil),
    description: optional(value.description),
  }
}

export function EquipmentPage() {
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view')
  // SMA-EQUIPMENT-HISTORY-PARTS-110B: карточка разделена на вкладки.
  const [tab, setTab] = useState<'overview' | 'history' | 'parts'>('overview')
  const [form, setForm] = useState<FormValue>(emptyForm)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const linkedClientsQ = useQuery({
    queryKey: ['equipment-linked-clients'],
    queryFn: () => api.getLinkedClients().catch(() => []),
  })
  const linkedClients = linkedClientsQ.data || []
  const isProviderScope = linkedClients.length > 0
  const [selectedClientId, setSelectedClientId] = useState('')

  // Контур клиента выбирается так же, как в «Локациях»: подсказка из профиля,
  // иначе единственный доступный клиент.
  useEffect(() => {
    if (!isProviderScope) {
      if (selectedClientId) setSelectedClientId('')
      return
    }
    if (selectedClientId && linkedClients.some((c) => c.clientCompany.id === selectedClientId)) return
    const hint = api.getLinkedClientCompanyIdFromMe(meQ.data)
    const fromHint = hint && linkedClients.some((c) => c.clientCompany.id === hint) ? hint : ''
    const onlyOne = linkedClients.length === 1 ? linkedClients[0].clientCompany.id : ''
    const next = fromHint || onlyOne || ''
    if (next !== selectedClientId) setSelectedClientId(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProviderScope, linkedClientsQ.dataUpdatedAt, meQ.dataUpdatedAt])

  const scopeCompanyId = isProviderScope ? selectedClientId : ''
  const scopeReady = !isProviderScope || !!scopeCompanyId
  const canManage = MANAGER_ROLES.includes(String(meQ.data?.role || ''))

  // Поиск не бьёт по серверу на каждую букву.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const listQ = useQuery({
    queryKey: ['equipment-list', scopeCompanyId, search, locationFilter, statusFilter],
    queryFn: () =>
      api.listEquipment({
        companyId: scopeCompanyId || undefined,
        search: search || undefined,
        locationId: locationFilter || undefined,
        status: statusFilter || undefined,
      }),
    enabled: scopeReady,
  })

  const locationsQ = useQuery({
    queryKey: ['equipment-locations', scopeCompanyId],
    queryFn: () => api.locations(scopeCompanyId || undefined),
    enabled: scopeReady,
  })

  const rows = listQ.data || []
  const locationOptions = useMemo(() => {
    const list = [...(locationsQ.data || [])]
    list.sort((a, b) => `${a.platformCode || ''} ${a.name}`.localeCompare(`${b.platformCode || ''} ${b.name}`))
    return list
  }, [locationsQ.data])

  const selected = rows.find((row) => row.id === selectedId) || null

  async function refreshList() {
    await qc.invalidateQueries({ queryKey: ['equipment-list'] })
  }

  const createM = useMutation({
    mutationFn: (value: FormValue) => api.createEquipment(toSaveInput(value, 'create')),
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(`Оборудование «${created.name}» добавлено`)
      setMode('view')
      setSelectedId(created.id)
      await refreshList()
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const updateM = useMutation({
    mutationFn: (params: { id: string; value: FormValue }) =>
      api.updateEquipment(params.id, toSaveInput(params.value, 'update')),
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess(`Карточка «${updated.name}» сохранена`)
      setMode('view')
      await refreshList()
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const photoM = useMutation({
    mutationFn: (params: { id: string; file: File }) =>
      api.uploadEquipmentPhoto(params.id, params.file),
    onSuccess: async () => {
      setErr(null)
      setSuccess('Снимок загружен')
      await refreshList()
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const busy = createM.isPending || updateM.isPending || photoM.isPending

  function beginCreate() {
    setErr(null)
    setSuccess(null)
    setSelectedId(null)
    setForm({ ...emptyForm, locationId: locationFilter || locationOptions[0]?.id || '' })
    setMode('create')
  }

  function beginEdit(item: api.EquipmentListItem) {
    setErr(null)
    setSuccess(null)
    setForm(toFormValue(item))
    setMode('edit')
  }

  function patch(next: Partial<FormValue>) {
    setForm((current) => ({ ...current, ...next }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    setSuccess(null)
    if (!form.name.trim()) {
      setErr('Название обязательно')
      return
    }
    if (!form.type.trim()) {
      setErr('Тип обязателен')
      return
    }
    if (mode === 'create') {
      if (!form.locationId) {
        setErr('Выберите точку — оборудование всегда стоит на конкретном объекте')
        return
      }
      createM.mutate(form)
      return
    }
    if (selected) updateM.mutate({ id: selected.id, value: form })
  }

  function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selected) return
    photoM.mutate({ id: selected.id, file })
  }

  return (
    <div className="managementPage">
      <div className="managementPageContext">
        <div className="row">
          <div>
            <h2 style={{ marginBottom: 4 }}>Оборудование</h2>
            <div className="muted small">
              {listQ.isFetching ? 'Загрузка…' : `Найдено единиц: ${rows.length}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="ghost" onClick={() => listQ.refetch()} disabled={busy}>
              Обновить
            </button>
            {canManage ? (
              <button onClick={beginCreate} disabled={busy || !scopeReady}>
                Добавить оборудование
              </button>
            ) : null}
            <Link to="/objects"><button className="ghost">Точки</button></Link>
          </div>
        </div>

        <div className="managementContextControls">
          <label className="muted small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Поиск:</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Название, производитель, серийный или инвентарный номер"
              style={{ minWidth: 320 }}
            />
          </label>
          <label className="muted small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Точка:</span>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Все точки</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {[location.platformCode, location.name].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
          <label className="muted small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Статус:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Любой</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          {isProviderScope ? (
            <label className="muted small" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>Клиент (контур):</span>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                <option value="">— выберите клиента —</option>
                {linkedClients.map((c) => (
                  <option key={c.clientCompany.id} value={c.clientCompany.id}>
                    {c.clientCompany.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="pageHint">
        Карточка оборудования — это паспорт единицы: где стоит, чем является, с какого числа
        работает и до какого числа на гарантии.
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}
      {listQ.isError ? (
        <div className="alert">{(listQ.error as any)?.message || String(listQ.error)}</div>
      ) : null}
      {isProviderScope && !scopeCompanyId ? (
        <div className="muted small">Выберите клиента, чтобы увидеть его парк оборудования.</div>
      ) : null}

      <div className="grid2" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Реестр</h3>
          {rows.length === 0 ? (
            <div className="muted small">
              {listQ.isFetching
                ? 'Загрузка…'
                : search || locationFilter || statusFilter
                  ? 'Ничего не найдено — попробуйте изменить фильтры.'
                  : 'Оборудование ещё не заведено.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((item) => (
                <button
                  key={item.id}
                  className="ghost"
                  onClick={() => {
                    setSelectedId(item.id)
                    setMode('view')
                    setTab('overview')
                    setErr(null)
                    setSuccess(null)
                  }}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    textAlign: 'left',
                    fontWeight: item.id === selectedId ? 600 : 400,
                  }}
                >
                  {item.mainPhoto?.url ? (
                    <ProtectedUploadImg
                      url={item.mainPhoto.url}
                      alt={item.name}
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : null}
                  <span style={{ flex: 1 }}>
                    {item.name}
                    <span className="muted small" style={{ display: 'block' }}>
                      {[locationLabel(item), item.serialNumber || null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="muted small">{statusLabel(item.status)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          {/* Единица могла уйти из выборки после смены фильтра — тогда правка закрывается сама. */}
          {mode === 'create' || (mode === 'edit' && selected) ? (
            <form onSubmit={submit}>
              <h3 style={{ marginTop: 0 }}>
                {mode === 'create' ? 'Новое оборудование' : `Правка: ${selected?.name || ''}`}
              </h3>

              {mode === 'create' ? (
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Точка
                  <select
                    value={form.locationId}
                    onChange={(e) => patch({ locationId: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">— выберите точку —</option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {[location.platformCode, location.name].filter(Boolean).join(' · ')}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="muted small" style={{ marginBottom: 8 }}>
                  Точка: {selected ? locationLabel(selected) : '—'} (переносится отдельной операцией)
                </div>
              )}

              <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                Название
                <input value={form.name} onChange={(e) => patch({ name: e.target.value })} style={{ width: '100%' }} />
              </label>

              <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                Тип
                <input value={form.type} onChange={(e) => patch({ type: e.target.value })} style={{ width: '100%' }} />
              </label>

              {mode === 'edit' ? (
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Статус
                  <select value={form.status} onChange={(e) => patch({ status: e.target.value })} style={{ width: '100%' }}>
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid2">
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Производитель
                  <input value={form.manufacturer} onChange={(e) => patch({ manufacturer: e.target.value })} style={{ width: '100%' }} />
                </label>
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Модель
                  <input value={form.model} onChange={(e) => patch({ model: e.target.value })} style={{ width: '100%' }} />
                </label>
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Серийный номер
                  <input value={form.serialNumber} onChange={(e) => patch({ serialNumber: e.target.value })} style={{ width: '100%' }} />
                </label>
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Инвентарный номер
                  <input value={form.inventoryNumber} onChange={(e) => patch({ inventoryNumber: e.target.value })} style={{ width: '100%' }} />
                </label>
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Ввод в эксплуатацию
                  <input type="date" value={form.commissionedAt} onChange={(e) => patch({ commissionedAt: e.target.value })} style={{ width: '100%' }} />
                </label>
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Гарантия до
                  <input type="date" value={form.warrantyUntil} onChange={(e) => patch({ warrantyUntil: e.target.value })} style={{ width: '100%' }} />
                </label>
              </div>

              <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                Описание
                <textarea
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                  style={{ width: '100%' }}
                />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={busy}>
                  {mode === 'create' ? 'Добавить' : 'Сохранить'}
                </button>
                <button type="button" className="ghost" onClick={() => setMode('view')} disabled={busy}>
                  Отмена
                </button>
              </div>
            </form>
          ) : selected ? (
            <div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: 4 }}>{selected.name}</h3>
                  <div className="muted small">{selected.type}</div>
                </div>
                {canManage && tab === 'overview' ? (
                  <button className="ghost" onClick={() => beginEdit(selected)} disabled={busy}>
                    Редактировать
                  </button>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
                {([
                  ['overview', 'Обзор'],
                  ['history', 'История'],
                  ['parts', 'Компоненты'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className="ghost"
                    onClick={() => setTab(key)}
                    style={{ fontWeight: tab === key ? 700 : 400 }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'history' ? (
                <EquipmentHistoryTab equipmentId={selected.id} scopeCompanyId={scopeCompanyId || undefined} />
              ) : tab === 'parts' ? (
                <EquipmentPartsTab
                  equipmentId={selected.id}
                  scopeCompanyId={scopeCompanyId || undefined}
                  canManage={canManage}
                />
              ) : (
              <>
              {selected.mainPhoto?.url ? (
                <ProtectedUploadImg
                  url={selected.mainPhoto.url}
                  alt={selected.name}
                  style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, margin: '10px 0' }}
                />
              ) : (
                <div className="muted small" style={{ margin: '10px 0' }}>Снимка пока нет.</div>
              )}

              {canManage ? (
                <div style={{ marginBottom: 10 }}>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={pickPhoto}
                    style={{ display: 'none' }}
                  />
                  <button className="ghost" onClick={() => photoInputRef.current?.click()} disabled={busy}>
                    {photoM.isPending ? 'Загрузка…' : 'Загрузить снимок'}
                  </button>
                </div>
              ) : null}

              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: 0 }}>
                <dt className="muted small">Статус</dt>
                <dd style={{ margin: 0 }}>{statusLabel(selected.status)}</dd>
                <dt className="muted small">Точка</dt>
                <dd style={{ margin: 0 }}>{locationLabel(selected)}</dd>
                <dt className="muted small">Производитель</dt>
                <dd style={{ margin: 0 }}>{selected.manufacturer || '—'}</dd>
                <dt className="muted small">Модель</dt>
                <dd style={{ margin: 0 }}>{selected.model || '—'}</dd>
                <dt className="muted small">Серийный номер</dt>
                <dd style={{ margin: 0 }}>{selected.serialNumber || '—'}</dd>
                <dt className="muted small">Инвентарный номер</dt>
                <dd style={{ margin: 0 }}>{selected.inventoryNumber || '—'}</dd>
                <dt className="muted small">Ввод в эксплуатацию</dt>
                <dd style={{ margin: 0 }}>{fmtDate(selected.commissionedAt)}</dd>
                <dt className="muted small">Гарантия до</dt>
                <dd style={{ margin: 0 }}>
                  {fmtDate(selected.warrantyUntil)}
                  {warrantyExpired(selected) ? <span className="muted small"> · истекла</span> : null}
                </dd>
              </dl>

              {selected.description ? (
                <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{selected.description}</p>
              ) : null}
              </>
              )}
            </div>
          ) : (
            <div className="muted small">Выберите единицу в реестре, чтобы открыть карточку.</div>
          )}
        </div>
      </div>
    </div>
  )
}
