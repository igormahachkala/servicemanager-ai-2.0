import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { LocationForm, type LocationFormValue } from '../components/locations/LocationForm'
import { LocationList } from '../components/locations/LocationList'

const emptyForm: LocationFormValue = {
  pointNumber: '',
  name: '',
  city: '',
  address: '',
  isActive: true,
}

function normalizeText(value: string) {
  return value.trim()
}

function validate(value: LocationFormValue) {
  if (!normalizeText(value.pointNumber)) return 'Номер точки обязателен'
  if (!normalizeText(value.name)) return 'Название обязательно'
  return null
}

function suggestCoordsPatch(value: LocationFormValue): {
  latitude?: number
  longitude?: number
} {
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return { latitude: value.latitude, longitude: value.longitude }
  }
  return {}
}

function toCreateInput(value: LocationFormValue): api.CreateLocationInput {
  return {
    name: normalizeText(value.name),
    city: normalizeText(value.city) || undefined,
    address: normalizeText(value.address) || undefined,
    platformCode: normalizeText(value.pointNumber),
    isActive: value.isActive,
    ...suggestCoordsPatch(value),
  }
}

function toUpdateInput(value: LocationFormValue): api.UpdateLocationInput {
  return {
    name: normalizeText(value.name),
    city: normalizeText(value.city) || null,
    address: normalizeText(value.address) || null,
    platformCode: normalizeText(value.pointNumber),
    ...suggestCoordsPatch(value),
  }
}

function toFormValue(location: api.LocationListItem): LocationFormValue {
  return {
    pointNumber: location.platformCode || '',
    name: location.name || '',
    city: location.city || '',
    address: location.address || '',
    isActive: location.isActive !== false,
  }
}

function locationSaveMessage(
  location: Pick<api.LocationListItem, 'name' | 'address' | 'latitude' | 'longitude'>,
  verb: 'создан' | 'обновлён',
) {
  const hasCoords =
    typeof location.latitude === 'number' && typeof location.longitude === 'number'
  if (hasCoords) {
    return `Объект «${location.name}» ${verb}. Координаты: ${location.latitude}, ${location.longitude}`
  }
  if (location.address) {
    return `Объект «${location.name}» ${verb}. Координаты не определены`
  }
  return `Объект «${location.name}» ${verb}`
}

export function LocationsPage() {
  const qc = useQueryClient()

  const [createErr, setCreateErr] = useState<string | null>(null)
  const [editErr, setEditErr] = useState<string | null>(null)
  const [listErr, setListErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createValue, setCreateValue] = useState<LocationFormValue>(emptyForm)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [editingLocationActive, setEditingLocationActive] = useState(true)
  const [editValue, setEditValue] = useState<LocationFormValue>(emptyForm)
  const [showDeleted, setShowDeleted] = useState(false)

  // SMA-P0-FE-CREATE-LOCATION-LINKED-SCOPE-001: провайдер создаёт/смотрит точки в контуре выбранного
  // клиента. linked-clients непуст → это провайдерский контур; у клиента эндпоинт возвращает [] (свой tenant).
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const linkedClientsQ = useQuery({
    queryKey: ['locations-linked-clients'],
    queryFn: () => api.getLinkedClients().catch(() => []),
  })
  const linkedClients = linkedClientsQ.data || []
  const isProviderScope = linkedClients.length > 0
  const [selectedClientId, setSelectedClientId] = useState('')

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

  function clearMessages() {
    setCreateErr(null)
    setEditErr(null)
    setListErr(null)
    setSuccess(null)
  }

  const scopeCompanyId = isProviderScope ? selectedClientId : ''
  const canCreate = !isProviderScope || !!scopeCompanyId

  const locationsQ = useQuery({
    queryKey: ['locations', showDeleted, scopeCompanyId],
    queryFn: () => api.locations(scopeCompanyId || undefined, { includeDeleted: showDeleted }),
    enabled: !isProviderScope || !!scopeCompanyId,
  })

  const sortedLocations = useMemo(() => {
    const rows = [...(locationsQ.data || [])]
    rows.sort((a, b) => `${a.platformCode || ''} ${a.name}`.localeCompare(`${b.platformCode || ''} ${b.name}`))
    return rows
  }, [locationsQ.data])

  async function invalidateLocationQueries() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['locations'] }),
      qc.invalidateQueries({ queryKey: ['map-locations'] }),
    ])
  }

  const createM = useMutation({
    mutationFn: (value: LocationFormValue) => api.createLocation(toCreateInput(value), scopeCompanyId || undefined),
    onSuccess: async (created) => {
      setCreateErr(null)
      setSuccess(locationSaveMessage(created, 'создан'))
      setCreateValue(emptyForm)
      await invalidateLocationQueries()
    },
    onError: (error: any) => {
      setSuccess(null)
      setCreateErr(error?.message || String(error))
    },
  })

  const updateM = useMutation({
    mutationFn: async (params: { id: string; value: LocationFormValue; initialIsActive: boolean }) => {
      const updated = await api.updateLocation(params.id, toUpdateInput(params.value), scopeCompanyId || undefined)
      if (params.initialIsActive !== params.value.isActive) {
        return api.setLocationStatus(params.id, params.value.isActive, scopeCompanyId || undefined)
      }
      return updated
    },
    onSuccess: async (updated) => {
      setEditErr(null)
      setSuccess(locationSaveMessage(updated, 'обновлён'))
      setEditingLocationId(null)
      setEditingLocationActive(true)
      setEditValue(emptyForm)
      await invalidateLocationQueries()
    },
    onError: (error: any) => {
      setSuccess(null)
      setEditErr(error?.message || String(error))
    },
  })

  function patchCreate(patch: Partial<LocationFormValue>) {
    setCreateValue((current) => ({ ...current, ...patch }))
  }

  function patchEdit(patch: Partial<LocationFormValue>) {
    setEditValue((current) => ({ ...current, ...patch }))
  }

  function beginEdit(location: api.LocationListItem) {
    clearMessages()
    setEditingLocationId(location.id)
    setEditingLocationActive(location.isActive !== false)
    setEditValue(toFormValue(location))
  }

  function cancelEdit() {
    setEditErr(null)
    setEditingLocationId(null)
    setEditingLocationActive(true)
    setEditValue(emptyForm)
  }

  function submitCreate(event: React.FormEvent) {
    event.preventDefault()
    clearMessages()
    if (isProviderScope && !scopeCompanyId) {
      setCreateErr('Выберите клиента, для которого создаётся объект.')
      return
    }
    const validationError = validate(createValue)
    if (validationError) {
      setCreateErr(validationError)
      return
    }
    createM.mutate(createValue)
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingLocationId) return
    clearMessages()
    const validationError = validate(editValue)
    if (validationError) {
      setEditErr(validationError)
      return
    }
    updateM.mutate({ id: editingLocationId, value: editValue, initialIsActive: editingLocationActive })
  }

  const deleteLocationM = useMutation({
    mutationFn: (id: string) => api.deleteLocation(id, scopeCompanyId || undefined),
    onSuccess: async (deleted) => {
      setListErr(null)
      setSuccess(`Точка «${deleted.name}» удалена`)
      if (editingLocationId === deleted.id) {
        setEditErr(null)
        setEditingLocationId(null)
        setEditValue(emptyForm)
      }
      await invalidateLocationQueries()
    },
    onError: (error: any) => {
      setSuccess(null)
      setListErr(error?.message || String(error))
    },
  })

  const restoreLocationM = useMutation({
    mutationFn: (id: string) => api.restoreLocation(id, scopeCompanyId || undefined),
    onSuccess: async (restored) => {
      setListErr(null)
      setSuccess(`Точка «${restored.name}» восстановлена`)
      await invalidateLocationQueries()
    },
    onError: (error: any) => {
      setSuccess(null)
      setListErr(error?.message || String(error))
    },
  })

  function deleteLocation(location: api.LocationListItem) {
    if (!window.confirm(`Удалить точку «${location.name}»? Можно восстановить через переключатель «Показать удалённые».`)) return
    clearMessages()
    deleteLocationM.mutate(location.id)
  }

  function restoreLocation(location: api.LocationListItem) {
    clearMessages()
    restoreLocationM.mutate(location.id)
  }

  const busy = createM.isPending || updateM.isPending || deleteLocationM.isPending || restoreLocationM.isPending

  return (
    <div className="managementPage">
      <div className="managementPageContext">
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Объекты</h2>
          <div className="muted small">
            {locationsQ.isFetching ? 'Загрузка…' : `Всего объектов: ${sortedLocations.length}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => locationsQ.refetch()} disabled={busy}>
            Обновить
          </button>
          <Link to="/tickets/new"><button className="ghost">Создать заявку</button></Link>
          <Link to="/map"><button className="ghost">Открыть карту</button></Link>
        </div>
      </div>

      <div className="managementContextControls">
        <label className="muted small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Показать удалённые
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

      <div className="pageHint">Точки — это реальные объекты клиента, к которым привязываются заявки.</div>

      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}
      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}

      {isProviderScope ? (
        <div className="muted small">
          Точки создаются и отображаются в контуре выбранного клиента.
        </div>
      ) : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="panel">
          {canCreate ? (
            <LocationForm
              title="Создать объект"
              submitLabel="Создать объект"
              value={createValue}
              submitting={createM.isPending}
              error={createErr}
              onChange={patchCreate}
              onSubmit={submitCreate}
            />
          ) : (
            <div className="alert">
              Выберите клиента выше — создание точек доступно только в контуре клиента.
            </div>
          )}
        </div>

        <div className="panel">
          <div className="row" style={{ marginBottom: 10, gap: 8 }}>
            <h3 style={{ margin: 0 }}>Список объектов</h3>
          </div>
          {listErr ? (
            <div className="alert" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>
              {listErr}
            </div>
          ) : null}
          {isProviderScope && !scopeCompanyId ? (
            <div className="muted">Выберите клиента, чтобы увидеть его объекты.</div>
          ) : locationsQ.isLoading ? (
            <div className="muted">Загружаем объекты…</div>
          ) : (
            <LocationList
              locations={sortedLocations}
              scopeCompanyId={scopeCompanyId}
              isProviderScope={isProviderScope}
              editingLocationId={editingLocationId}
              editingValue={editValue}
              editError={editErr}
              busy={busy}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onEditChange={patchEdit}
              onSubmitEdit={submitEdit}
              onDelete={deleteLocation}
              onRestore={restoreLocation}
            />
          )}
        </div>
      </div>
    </div>
  )
}
