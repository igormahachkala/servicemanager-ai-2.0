import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { groupInspectionItemsByZone, numericConstraintLabel, responseTypeLabel } from '../lib/inspectionZones'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

type TemplateDraftItem = {
  title: string
  description: string
  zoneName: string
  zoneSortOrder: string
  checkpointSortOrder: string
  responseType: api.InspectionCheckpointResponseType
  numericMin: string
  numericMax: string
  numericUnit: string
  isRequired: boolean
}

const emptyDraftItem = (): TemplateDraftItem => ({
  title: '',
  description: '',
  zoneName: '',
  zoneSortOrder: '',
  checkpointSortOrder: '',
  responseType: 'NORMAL_PROBLEM',
  numericMin: '',
  numericMax: '',
  numericUnit: '',
  isRequired: true,
})

function parseOptionalNumber(value: string, label: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) throw new Error(`${label}: укажите число`)
  return parsed
}

function parseOptionalInteger(value: string, label: string): number | undefined {
  const parsed = parseOptionalNumber(value, label)
  if (parsed === undefined) return undefined
  if (!Number.isInteger(parsed)) throw new Error(`${label}: укажите целое число`)
  return parsed
}

export function InspectionTemplatesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [draftItems, setDraftItems] = useState<TemplateDraftItem[]>([emptyDraftItem(), emptyDraftItem()])

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const templatesQ = useQuery({ queryKey: ['inspection-templates'], queryFn: api.getInspectionTemplates })
  const runsQ = useQuery({ queryKey: ['inspection-runs'], queryFn: api.getInspectionRuns })
  const locationsQ = useQuery({ queryKey: ['locations'], queryFn: () => api.locations() })
  const equipmentQ = useQuery({
    queryKey: ['equipment-by-location', locationId],
    queryFn: () => api.equipmentByLocation(locationId),
    enabled: !!locationId,
  })

  const canCreateTemplate = meQ.data?.role === 'ADMIN'

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
  const selectedTemplateZones = useMemo(
    () => (selectedTemplate ? groupInspectionItemsByZone(selectedTemplate.items) : []),
    [selectedTemplate],
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

  const createTemplateM = useMutation({
    mutationFn: async () => {
      const items = draftItems
        .map((item, index) => {
          const numericMin = parseOptionalNumber(item.numericMin, 'Минимум')
          const numericMax = parseOptionalNumber(item.numericMax, 'Максимум')
          if (numericMin !== undefined && numericMax !== undefined && numericMin > numericMax) {
            throw new Error('Минимум не может быть больше максимума')
          }

          return {
            title: item.title.trim(),
            description: item.description.trim() || undefined,
            zoneName: item.zoneName.trim() || undefined,
            zoneSortOrder: parseOptionalInteger(item.zoneSortOrder, 'Порядок зоны') ?? 0,
            checkpointSortOrder: parseOptionalInteger(item.checkpointSortOrder, 'Порядок пункта') ?? index,
            responseType: item.responseType,
            numericMin,
            numericMax,
            numericUnit: item.numericUnit.trim() || undefined,
            isRequired: item.isRequired,
            sortOrder: index,
          }
        })
        .filter((item) => item.title)

      if (!templateName.trim()) {
        throw new Error('Название шаблона обязательно')
      }
      if (items.length === 0) {
        throw new Error('Добавьте хотя бы один пункт обхода')
      }

      return api.createInspectionTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        items,
      })
    },
    onSuccess: async (template) => {
      setError(null)
      setCreateOpen(false)
      setTemplateName('')
      setTemplateDescription('')
      setDraftItems([emptyDraftItem(), emptyDraftItem()])
      await queryClient.invalidateQueries({ queryKey: ['inspection-templates'] })
      setSelectedTemplateId(template.id)
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

  function updateDraftItem(index: number, patch: Partial<TemplateDraftItem>) {
    setDraftItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Обходы</h2>
          <div className="muted small">Выберите шаблон и запустите обход по точке.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canCreateTemplate ? (
            <button type="button" className="ghost" onClick={() => setCreateOpen((current) => !current)}>
              {createOpen ? 'Скрыть форму' : 'Создать шаблон обхода'}
            </button>
          ) : null}
          <Link to="/inspection/runs"><button className="ghost">История обходов</button></Link>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {templatesQ.isError ? <div className="alert">{(templatesQ.error as any)?.message || String(templatesQ.error)}</div> : null}
      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}

      {createOpen && canCreateTemplate ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Новый шаблон обхода</h3>
              <div className="muted small">Создайте шаблон с базовыми пунктами проверки.</div>
            </div>
          </div>

          <div className="form">
            <label>
              Название шаблона
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ежедневный обход точки" />
            </label>

            <label>
              Описание
              <input value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="Краткое описание шаблона" />
            </label>

            <div style={{ display: 'grid', gap: 10 }}>
              {draftItems.map((item, index) => (
                <div key={index} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Пункт {index + 1}</div>
                  <div className="form">
                    <div className="grid2" style={{ gridTemplateColumns: '1fr 120px 120px', gap: 10 }}>
                      <label>
                        Зона
                        <input
                          value={item.zoneName}
                          onChange={(e) => updateDraftItem(index, { zoneName: e.target.value })}
                          placeholder="Например: Зал"
                        />
                      </label>
                      <label>
                        Порядок зоны
                        <input
                          type="number"
                          min={0}
                          value={item.zoneSortOrder}
                          onChange={(e) => updateDraftItem(index, { zoneSortOrder: e.target.value })}
                          placeholder="0"
                        />
                      </label>
                      <label>
                        Порядок пункта
                        <input
                          type="number"
                          min={0}
                          value={item.checkpointSortOrder}
                          onChange={(e) => updateDraftItem(index, { checkpointSortOrder: e.target.value })}
                          placeholder={String(index)}
                        />
                      </label>
                    </div>

                    <label>
                      Заголовок
                      <input
                        value={item.title}
                        onChange={(e) => updateDraftItem(index, { title: e.target.value })}
                        placeholder="Например: Проверить фасад оборудования"
                      />
                    </label>

                    <label>
                      Комментарий для техника
                      <input
                        value={item.description}
                        onChange={(e) => updateDraftItem(index, { description: e.target.value })}
                        placeholder="Что именно нужно проверить"
                      />
                    </label>

                    <div className="grid2" style={{ gridTemplateColumns: '1fr 110px 110px 110px', gap: 10 }}>
                      <label>
                        Тип ответа
                        <select
                          value={item.responseType}
                          onChange={(e) =>
                            updateDraftItem(index, {
                              responseType: e.target.value as api.InspectionCheckpointResponseType,
                              numericMin: e.target.value === 'NUMBER' ? item.numericMin : '',
                              numericMax: e.target.value === 'NUMBER' ? item.numericMax : '',
                              numericUnit: e.target.value === 'NUMBER' ? item.numericUnit : '',
                            })
                          }
                        >
                          <option value="NORMAL_PROBLEM">Проблема/норма</option>
                          <option value="YES_NO">Да/Нет</option>
                          <option value="NUMBER">Число</option>
                          <option value="TEXT">Текст</option>
                          <option value="PHOTO">Фото</option>
                        </select>
                      </label>
                      <label>
                        Мин.
                        <input
                          type="number"
                          value={item.numericMin}
                          onChange={(e) => updateDraftItem(index, { numericMin: e.target.value })}
                          disabled={item.responseType !== 'NUMBER'}
                        />
                      </label>
                      <label>
                        Макс.
                        <input
                          type="number"
                          value={item.numericMax}
                          onChange={(e) => updateDraftItem(index, { numericMax: e.target.value })}
                          disabled={item.responseType !== 'NUMBER'}
                        />
                      </label>
                      <label>
                        Ед.
                        <input
                          value={item.numericUnit}
                          onChange={(e) => updateDraftItem(index, { numericUnit: e.target.value })}
                          disabled={item.responseType !== 'NUMBER'}
                          placeholder="°C"
                        />
                      </label>
                    </div>

                    <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        onChange={(e) => updateDraftItem(index, { isRequired: e.target.checked })}
                      />
                      Обязательный пункт
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="ghost" onClick={() => setDraftItems((current) => [...current, emptyDraftItem()])}>
                Добавить пункт
              </button>
              {draftItems.length > 1 ? (
                <button type="button" className="ghost" onClick={() => setDraftItems((current) => current.slice(0, -1))}>
                  Удалить последний пункт
                </button>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => createTemplateM.mutate()} disabled={createTemplateM.isPending}>
                {createTemplateM.isPending ? 'Сохраняем...' : 'Создать шаблон обхода'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setCreateOpen(false)
                  setTemplateName('')
                  setTemplateDescription('')
                  setDraftItems([emptyDraftItem(), emptyDraftItem()])
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid2" style={{ gridTemplateColumns: '1.3fr 0.9fr' }}>
        <div className="panel">
          <div className="row" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Шаблоны обхода</h3>
            {!templatesQ.isLoading && activeTemplates.length > 0 ? (
              <div className="muted small">Шаблонов: {activeTemplates.length}</div>
            ) : null}
          </div>
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
              <div className="panel" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Шаблонов пока нет</div>
                <div className="muted small" style={{ marginBottom: 10 }}>
                  Создайте первый шаблон обхода, чтобы техники могли запускать проверки по точкам.
                </div>
                {canCreateTemplate ? (
                  <button type="button" className="ghost" onClick={() => setCreateOpen(true)}>
                    Создать шаблон обхода
                  </button>
                ) : (
                  <div className="muted small">Шаблоны создаёт администратор компании.</div>
                )}
              </div>
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
                  {selectedTemplateZones.map((zone) => (
                    <div key={zone.key} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontWeight: 700 }}>{zone.name}</div>
                      {zone.items.map((item) => (
                        <div key={item.id} className="muted small">
                          {item.checkpointSortOrder + 1}. {item.title} · {responseTypeLabel(item.responseType)}
                          {numericConstraintLabel(item) ? ` · ${numericConstraintLabel(item)}` : ''}
                          {item.isRequired ? '' : ' (необязательно)'}
                        </div>
                      ))}
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
