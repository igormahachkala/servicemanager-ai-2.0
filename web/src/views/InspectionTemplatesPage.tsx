import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

export function InspectionTemplatesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const templatesQ = useQuery({ queryKey: ['inspection-templates'], queryFn: api.getInspectionTemplates })
  const runsQ = useQuery({ queryKey: ['inspection-runs'], queryFn: api.getInspectionRuns })
  const locationsQ = useQuery({ queryKey: ['locations'], queryFn: () => api.locations() })
  const equipmentQ = useQuery({
    queryKey: ['equipment-by-location', locationId],
    queryFn: () => api.equipmentByLocation(locationId),
    enabled: !!locationId,
  })

  const activeLocations = useMemo(
    () => (locationsQ.data || []).filter((item) => item.isActive !== false),
    [locationsQ.data],
  )
  const activeTemplates = useMemo(
    () => (templatesQ.data || []).filter((item) => item.isActive !== false),
    [templatesQ.data],
  )

  const selectedTemplate = useMemo(
    () => activeTemplates.find((item) => item.id === selectedTemplateId) || null,
    [activeTemplates, selectedTemplateId],
  )

  const startRunM = useMutation({
    mutationFn: api.startInspectionRun,
    onSuccess: async (run) => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      queryClient.setQueryData(['inspection-run', run.id], run)
      navigate('/inspection/runs/' + run.id)
    },
    onError: (err: any) => setError(err?.message || String(err)),
  })

  function startRun() {
    if (!selectedTemplateId) {
      setError('Выберите шаблон обхода')
      return
    }
    if (!locationId) {
      setError('Выберите локацию')
      return
    }

    startRunM.mutate({
      templateId: selectedTemplateId,
      locationId,
      equipmentId: equipmentId || undefined,
      title: customTitle.trim() || undefined,
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Обходы</h2>
          <div className="muted small">Выберите шаблон и запустите обход по точке.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/inspection/runs"><button className="ghost">История обходов</button></Link>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {templatesQ.isError ? <div className="alert">{(templatesQ.error as any)?.message || String(templatesQ.error)}</div> : null}
      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: '1.3fr 0.9fr' }}>
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Шаблоны обхода</h3>
          {templatesQ.isLoading ? <div className="muted">Загружаем шаблоны…</div> : null}
          <div style={{ display: 'grid', gap: 12 }}>
            {activeTemplates.map((template) => {
              const active = template.id === selectedTemplateId
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className="panel"
                  style={{
                    textAlign: 'left',
                    border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
                    background: active ? '#eff6ff' : '#fff',
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{template.name}</div>
                  {template.description ? <div className="muted small" style={{ marginBottom: 8 }}>{template.description}</div> : null}
                  <div className="muted small">Пунктов: {template.items.length} · Создан: {fmtDate(template.createdAt)}</div>
                </button>
              )
            })}
            {!templatesQ.isLoading && activeTemplates.length === 0 ? (
              <div className="muted">Шаблонов пока нет.</div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Запуск обхода</h3>
          <div className="form">
            <label>
              Шаблон
              <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                <option value="">Выберите шаблон</option>
                {activeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>

            <label>
              Локация
              <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setEquipmentId('') }}>
                <option value="">Выберите локацию</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}{location.city ? ` · ${location.city}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Оборудование (опционально)
              <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={!locationId || equipmentQ.isLoading}>
                <option value="">Без привязки к оборудованию</option>
                {(equipmentQ.data || []).map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>{equipment.name} · {equipment.type}</option>
                ))}
              </select>
            </label>

            <label>
              Название запуска (опционально)
              <input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder={selectedTemplate?.name || 'Например: Утренний обход'} />
            </label>

            {selectedTemplate ? (
              <div className="panel" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Что будет в обходе</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {selectedTemplate.items.map((item) => (
                    <div key={item.id} className="muted small">
                      {item.sortOrder + 1}. {item.title}{item.isRequired ? '' : ' (необязательно)'}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <button type="button" onClick={startRun} disabled={startRunM.isPending || !selectedTemplateId || !locationId}>
              {startRunM.isPending ? 'Запускаем…' : 'Начать обход'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Последние обходы</h3>
          <Link to="/inspection/runs"><button className="ghost">Все обходы</button></Link>
        </div>
        {runsQ.isLoading ? <div className="muted">Загружаем обходы…</div> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          {(runsQ.data || []).slice(0, 5).map((run) => (
            <div key={run.id} className="card" style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
              <div className="row" style={{ marginBottom: 0, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{run.title}</div>
                  <div className="muted small">{run.template.name} · {run.location.name} · пунктов: {run._count.items}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="tag">{run.status}</span>
                  <Link to={'/inspection/runs/' + run.id}><button className="ghost">Открыть</button></Link>
                </div>
              </div>
            </div>
          ))}
          {!runsQ.isLoading && (runsQ.data || []).length === 0 ? <div className="muted">Обходов пока нет.</div> : null}
        </div>
      </div>
    </div>
  )
}
