import { useMemo, useState } from 'react'
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

function toCreateInput(value: LocationFormValue): api.CreateLocationInput {
  return {
    name: normalizeText(value.name),
    city: normalizeText(value.city) || undefined,
    address: normalizeText(value.address) || undefined,
    platformCode: normalizeText(value.pointNumber),
    isActive: value.isActive,
  }
}

function toUpdateInput(value: LocationFormValue): api.UpdateLocationInput {
  return {
    name: normalizeText(value.name),
    city: normalizeText(value.city) || null,
    address: normalizeText(value.address) || null,
    platformCode: normalizeText(value.pointNumber),
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

export function LocationsPage() {
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createValue, setCreateValue] = useState<LocationFormValue>(emptyForm)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [editingLocationActive, setEditingLocationActive] = useState(true)
  const [editValue, setEditValue] = useState<LocationFormValue>(emptyForm)

  const locationsQ = useQuery({ queryKey: ['locations'], queryFn: () => api.locations() })

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
    mutationFn: (value: LocationFormValue) => api.createLocation(toCreateInput(value)),
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(`Локация «${created.name}» создана`)
      setCreateValue(emptyForm)
      await invalidateLocationQueries()
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const updateM = useMutation({
    mutationFn: async (params: { id: string; value: LocationFormValue; initialIsActive: boolean }) => {
      const updated = await api.updateLocation(params.id, toUpdateInput(params.value))
      if (params.initialIsActive !== params.value.isActive) {
        return api.setLocationStatus(params.id, params.value.isActive)
      }
      return updated
    },
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess(`Локация «${updated.name}» обновлена`)
      setEditingLocationId(null)
      setEditingLocationActive(true)
      setEditValue(emptyForm)
      await invalidateLocationQueries()
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  function patchCreate(patch: Partial<LocationFormValue>) {
    setCreateValue((current) => ({ ...current, ...patch }))
  }

  function patchEdit(patch: Partial<LocationFormValue>) {
    setEditValue((current) => ({ ...current, ...patch }))
  }

  function beginEdit(location: api.LocationListItem) {
    setErr(null)
    setSuccess(null)
    setEditingLocationId(location.id)
    setEditingLocationActive(location.isActive !== false)
    setEditValue(toFormValue(location))
  }

  function cancelEdit() {
    setEditingLocationId(null)
    setEditingLocationActive(true)
    setEditValue(emptyForm)
  }

  function submitCreate(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    setSuccess(null)
    const validationError = validate(createValue)
    if (validationError) {
      setErr(validationError)
      return
    }
    createM.mutate(createValue)
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingLocationId) return
    setErr(null)
    setSuccess(null)
    const validationError = validate(editValue)
    if (validationError) {
      setErr(validationError)
      return
    }
    updateM.mutate({ id: editingLocationId, value: editValue, initialIsActive: editingLocationActive })
  }

  const busy = createM.isPending || updateM.isPending

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Локации</h2>
          <div className="muted small">
            {locationsQ.isFetching ? 'Загрузка…' : `Всего локаций: ${sortedLocations.length}`}
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

      <div className="pageHint">Точки — это реальные объекты клиента, к которым привязываются заявки.</div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}
      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="panel">
          <LocationForm
            title="Создать локацию"
            submitLabel="Создать локацию"
            value={createValue}
            submitting={createM.isPending}
            onChange={patchCreate}
            onSubmit={submitCreate}
          />
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Список локаций</h3>
          {locationsQ.isLoading ? (
            <div className="muted">Загружаем локации…</div>
          ) : (
            <LocationList
              locations={sortedLocations}
              editingLocationId={editingLocationId}
              editingValue={editValue}
              busy={busy}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onEditChange={patchEdit}
              onSubmitEdit={submitEdit}
            />
          )}
        </div>
      </div>
    </div>
  )
}
