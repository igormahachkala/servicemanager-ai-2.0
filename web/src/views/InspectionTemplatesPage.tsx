import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { groupInspectionItemsByZone, numericConstraintLabel, responseTypeLabel } from '../lib/inspectionZones'
import {
  buildTemplatePayload,
  emptyTemplateDraftItem,
  templateDraftSnapshot,
  templateToDraftItems,
  type TemplateDraftItem,
} from '../lib/inspectionTemplateEditor'

/** Роли, у которых по канонической матрице есть LOCATIONS_MANAGE. Подсказка интерфейса: решение принимает бэкенд. */
const MANAGER_ROLES = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function TemplateItemsEditor({
  items,
  onChange,
  categories,
  categoryContextLabel,
}: {
  items: TemplateDraftItem[]
  onChange: (items: TemplateDraftItem[]) => void
  categories: api.ProblemCategoryListItem[]
  categoryContextLabel: string
}) {
  type DraftZone = {
    key: string
    name: string
    order: number
    entries: Array<{ item: TemplateDraftItem; index: number; checkpointOrder: number }>
  }

  function readDraftOrder(value: string, fallback: number) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback
  }

  function sortedEntries(source = items) {
    return source
      .map((item, index) => ({
        item,
        index,
        zoneOrder: readDraftOrder(item.zoneSortOrder, index),
        checkpointOrder: readDraftOrder(item.checkpointSortOrder, index),
      }))
      .sort(
        (a, b) =>
          a.zoneOrder - b.zoneOrder ||
          a.checkpointOrder - b.checkpointOrder ||
          a.index - b.index,
      )
  }

  function normalizeDraftOrdering(source: TemplateDraftItem[]) {
    let currentZoneKey = ''
    let zoneOrder = -1
    let checkpointOrder = 0

    return sortedEntries(source).map(({ item }) => {
      const zoneKey = item.zoneName.trim() || 'Без зоны'
      if (zoneKey !== currentZoneKey) {
        currentZoneKey = zoneKey
        zoneOrder += 1
        checkpointOrder = 0
      }
      const next = {
        ...item,
        zoneSortOrder: String(zoneOrder),
        checkpointSortOrder: String(checkpointOrder),
      }
      checkpointOrder += 1
      return next
    })
  }

  function zonesFromItems(): DraftZone[] {
    const zones = new Map<string, DraftZone>()
    for (const entry of sortedEntries()) {
      const name = entry.item.zoneName.trim()
      const displayName = name || 'Без зоны'
      const key = `${entry.zoneOrder}:${displayName}`
      const existing = zones.get(key)
      if (existing) {
        existing.entries.push({ item: entry.item, index: entry.index, checkpointOrder: entry.checkpointOrder })
      } else {
        zones.set(key, {
          key,
          name: displayName,
          order: entry.zoneOrder,
          entries: [{ item: entry.item, index: entry.index, checkpointOrder: entry.checkpointOrder }],
        })
      }
    }
    return Array.from(zones.values()).sort((a, b) => a.order - b.order)
  }

  function replaceItem(index: number, patch: Partial<TemplateDraftItem>) {
    onChange(normalizeDraftOrdering(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))))
  }

  function replaceMany(patches: Array<{ index: number; patch: Partial<TemplateDraftItem> }>) {
    const byIndex = new Map(patches.map((entry) => [entry.index, entry.patch]))
    onChange(normalizeDraftOrdering(items.map((item, index) => (byIndex.has(index) ? { ...item, ...byIndex.get(index)! } : item))))
  }

  function addZone() {
    const zones = zonesFromItems()
    const order = zones.length
    onChange(normalizeDraftOrdering([
      ...items,
      {
        ...emptyTemplateDraftItem(),
        zoneName: `Новая зона ${order + 1}`,
        zoneSortOrder: String(order),
        checkpointSortOrder: '0',
      },
    ]))
  }

  function renameZone(zone: DraftZone, name: string) {
    replaceMany(zone.entries.map((entry) => ({ index: entry.index, patch: { zoneName: name } })))
  }

  function moveZone(zoneIndex: number, direction: -1 | 1) {
    const zones = zonesFromItems()
    const target = zoneIndex + direction
    if (target < 0 || target >= zones.length) return
    const currentZone = zones[zoneIndex]
    const targetZone = zones[target]
    replaceMany([
      ...currentZone.entries.map((entry) => ({ index: entry.index, patch: { zoneSortOrder: String(target) } })),
      ...targetZone.entries.map((entry) => ({ index: entry.index, patch: { zoneSortOrder: String(zoneIndex) } })),
    ])
  }

  function deleteZone(zone: DraftZone) {
    if (!window.confirm(`Удалить зону «${zone.name}» и все её пункты?`)) return
    const indexesToDelete = new Set(zone.entries.map((entry) => entry.index))
    const next = items.filter((_, index) => !indexesToDelete.has(index))
    onChange(next.length > 0 ? normalizeDraftOrdering(next) : [emptyTemplateDraftItem()])
  }

  function addCheckpoint(zone: DraftZone) {
    onChange(normalizeDraftOrdering([
      ...items,
      {
        ...emptyTemplateDraftItem(),
        zoneName: zone.name === 'Без зоны' ? '' : zone.name,
        zoneSortOrder: String(zone.order),
        checkpointSortOrder: String(zone.entries.length),
      },
    ]))
  }

  function deleteCheckpoint(index: number) {
    if (!window.confirm('Удалить пункт из шаблона?')) return
    const next = items.filter((_, itemIndex) => itemIndex !== index)
    onChange(next.length > 0 ? normalizeDraftOrdering(next) : [emptyTemplateDraftItem()])
  }

  function moveCheckpoint(zone: DraftZone, entryIndex: number, direction: -1 | 1) {
    const target = entryIndex + direction
    if (target < 0 || target >= zone.entries.length) return
    const current = zone.entries[entryIndex]
    const other = zone.entries[target]
    replaceMany([
      { index: current.index, patch: { checkpointSortOrder: String(target) } },
      { index: other.index, patch: { checkpointSortOrder: String(entryIndex) } },
    ])
  }

  const zones = zonesFromItems()

  return (
    <>
      <div style={{ display: 'grid', gap: 10 }}>
        {zones.map((zone, zoneIndex) => (
          <div key={zone.key} className="panel" style={{ padding: 12, display: 'grid', gap: 12 }}>
            <div className="row" style={{ alignItems: 'flex-end', marginBottom: 0 }}>
              <label style={{ flex: 1 }}>
                Зона {zoneIndex + 1}
                <input
                  value={zone.name === 'Без зоны' ? '' : zone.name}
                  onChange={(e) => renameZone(zone, e.target.value)}
                  placeholder="Например: Зал"
                />
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="ghost" onClick={() => moveZone(zoneIndex, -1)} disabled={zoneIndex === 0}>
                  ↑
                </button>
                <button type="button" className="ghost" onClick={() => moveZone(zoneIndex, 1)} disabled={zoneIndex === zones.length - 1}>
                  ↓
                </button>
                <button type="button" className="ghost" onClick={() => deleteZone(zone)}>
                  Удалить зону
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {zone.entries.map((entry, entryIndex) => {
                const item = entry.item
                const missingSelectedCategory =
                  item.defaultCategoryId && !categories.some((category) => category.id === item.defaultCategoryId)
                return (
                  <div key={item.id || `${zone.key}:${entry.index}`} className="panel" style={{ padding: 12 }}>
                    <div className="row" style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>Пункт {entryIndex + 1}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="ghost" onClick={() => moveCheckpoint(zone, entryIndex, -1)} disabled={entryIndex === 0}>
                          ↑
                        </button>
                        <button type="button" className="ghost" onClick={() => moveCheckpoint(zone, entryIndex, 1)} disabled={entryIndex === zone.entries.length - 1}>
                          ↓
                        </button>
                        <button type="button" className="ghost" onClick={() => deleteCheckpoint(entry.index)}>
                          Удалить пункт
                        </button>
                      </div>
                    </div>

                    <div className="form">
                      <label>
                        Название пункта
                        <input
                          value={item.title}
                          onChange={(e) => replaceItem(entry.index, { title: e.target.value })}
                          placeholder="Например: Освещение"
                        />
                      </label>

                      <label>
                        Комментарий для техника
                        <input
                          value={item.description}
                          onChange={(e) => replaceItem(entry.index, { description: e.target.value })}
                          placeholder="Что именно нужно проверить"
                        />
                      </label>

                      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                        <label>
                          Тип ответа
                          <select
                            value={item.responseType}
                            onChange={(e) =>
                              replaceItem(entry.index, {
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
                            onChange={(e) => replaceItem(entry.index, { numericMin: e.target.value })}
                            disabled={item.responseType !== 'NUMBER'}
                          />
                        </label>
                        <label>
                          Макс.
                          <input
                            type="number"
                            value={item.numericMax}
                            onChange={(e) => replaceItem(entry.index, { numericMax: e.target.value })}
                            disabled={item.responseType !== 'NUMBER'}
                          />
                        </label>
                        <label>
                          Ед.
                          <input
                            value={item.numericUnit}
                            onChange={(e) => replaceItem(entry.index, { numericUnit: e.target.value })}
                            disabled={item.responseType !== 'NUMBER'}
                            placeholder="°C"
                          />
                        </label>
                      </div>

                      <label>
                        Категория заявки по умолчанию
                        <select
                          value={item.defaultCategoryId}
                          onChange={(e) => replaceItem(entry.index, { defaultCategoryId: e.target.value })}
                        >
                          <option value="">Без категории</option>
                          {missingSelectedCategory ? (
                            <option value={item.defaultCategoryId}>Сохранённая подсказка недоступна</option>
                          ) : null}
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                              {category.isActive === false ? ' (отключена)' : ''}
                            </option>
                          ))}
                        </select>
                        <div className="muted small">
                          Подсказка для контура: {categoryContextLabel}. При запуске доступ проверит сервер.
                        </div>
                      </label>

                      <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={item.isRequired}
                          onChange={(e) => replaceItem(entry.index, { isRequired: e.target.checked })}
                        />
                        Обязательный пункт
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="button" className="ghost" onClick={() => addCheckpoint(zone)}>
              Добавить пункт в зону
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ghost" onClick={addZone}>
          Добавить зону
        </button>
      </div>
    </>
  )
}

export function InspectionTemplatesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [draftItems, setDraftItems] = useState<TemplateDraftItem[]>([emptyTemplateDraftItem(), emptyTemplateDraftItem()])
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editItems, setEditItems] = useState<TemplateDraftItem[]>([emptyTemplateDraftItem()])
  const [editBaseline, setEditBaseline] = useState('')

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const templatesQ = useQuery({ queryKey: ['inspection-templates'], queryFn: api.getInspectionTemplates })
  const runsQ = useQuery({ queryKey: ['inspection-runs'], queryFn: () => api.getInspectionRuns() })
  /**
   * SMA-ROUNDS-V1-PROVIDER-CLIENT-LOCATION-SELECTOR-103B.
   *
   * Обход по площадке клиента ведёт провайдер, и площадка принадлежит клиенту,
   * а не исполнителю. Список без companyId возвращал точки своей компании, поэтому
   * у провайдера в выборе не было ни одной обслуживаемой площадки.
   *
   * Контур выбирается так же, как на «Точках» и при создании заявки: linked-clients
   * непуст → это провайдерский контур. Свой резолвер доступа не заводится: и список
   * клиентов, и /locations?companyId=<клиент> проверяются на бэкенде каноническими
   * правилами контракта, а startRun ещё раз проверяет площадку через 097.
   * У клиента linked-clients пуст, companyId не передаётся — прежнее поведение.
   */
  const linkedClientsQ = useQuery({
    queryKey: ['inspection-linked-clients'],
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

  const scopeCompanyId = isProviderScope ? selectedClientId : ''

  const locationsQ = useQuery({
    queryKey: ['locations', scopeCompanyId],
    queryFn: () => api.locations(scopeCompanyId || undefined),
    enabled: !isProviderScope || !!scopeCompanyId,
  })
  const equipmentQ = useQuery({
    queryKey: ['equipment-by-location', locationId],
    queryFn: () => api.equipmentByLocation(locationId),
    enabled: !!locationId,
  })
  const templateCategoriesQ = useQuery({
    queryKey: ['problem-categories', 'inspection-template-hints', scopeCompanyId],
    queryFn: () => api.problemCategories(scopeCompanyId || undefined),
    enabled: !isProviderScope || !!scopeCompanyId,
  })

  useEffect(() => {
    // Смена клиента обнуляет выбор: площадка и оборудование принадлежат прежнему контуру.
    setLocationId('')
    setEquipmentId('')
  }, [scopeCompanyId])

  const canManageTemplates = MANAGER_ROLES.includes(String(meQ.data?.role || ''))

  const activeLocations = useMemo(
    () => (locationsQ.data || []).filter((item) => item.isActive !== false),
    [locationsQ.data],
  )
  const activeTemplates = useMemo(
    () => (templatesQ.data || []).filter((item) => item.isActive !== false),
    [templatesQ.data],
  )
  const templateCategories = useMemo(
    () => (templateCategoriesQ.data || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [templateCategoriesQ.data],
  )
  const categoryContextLabel = isProviderScope
    ? linkedClients.find((client) => client.clientCompany.id === scopeCompanyId)?.clientCompany.name || 'клиент не выбран'
    : 'своя компания'
  const selectedTemplate = useMemo(
    () => activeTemplates.find((item) => item.id === selectedTemplateId) || null,
    [activeTemplates, selectedTemplateId],
  )
  const selectedTemplateZones = useMemo(
    () => (selectedTemplate ? groupInspectionItemsByZone(selectedTemplate.items) : []),
    [selectedTemplate],
  )
  const editDirty = useMemo(
    () => editOpen && templateDraftSnapshot(editName, editDescription, editItems) !== editBaseline,
    [editBaseline, editDescription, editItems, editName, editOpen],
  )

  useEffect(() => {
    if (!editDirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [editDirty])

  const startRunM = useMutation({
    mutationFn: api.startInspectionRun,
    onSuccess: async (run) => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      queryClient.setQueryData(['inspection-run', run.id], run)
      navigate('/inspection/runs/' + run.id)
    },
    onError: (err: any) => {
      setSuccess(null)
      setError(err?.message || String(err))
    },
  })

  const createTemplateM = useMutation({
    mutationFn: async () => {
      return api.createInspectionTemplate(buildTemplatePayload(templateName, templateDescription, draftItems))
    },
    onSuccess: async (template) => {
      setError(null)
      setSuccess('Шаблон обхода создан')
      setCreateOpen(false)
      setTemplateName('')
      setTemplateDescription('')
      setDraftItems([emptyTemplateDraftItem(), emptyTemplateDraftItem()])
      await queryClient.invalidateQueries({ queryKey: ['inspection-templates'] })
      setSelectedTemplateId(template.id)
    },
    onError: (err: any) => {
      setSuccess(null)
      setError(err?.message || String(err))
    },
  })

  const updateTemplateM = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error('Выберите шаблон обхода')
      return api.updateInspectionTemplate(selectedTemplate.id, {
        ...buildTemplatePayload(editName, editDescription, editItems),
        updatedAt: selectedTemplate.updatedAt,
      })
    },
    onSuccess: async (template) => {
      setError(null)
      setSuccess('Шаблон обхода сохранён')
      setEditOpen(false)
      setEditBaseline('')
      await queryClient.invalidateQueries({ queryKey: ['inspection-templates'] })
      setSelectedTemplateId(template.id)
    },
    onError: (err: any) => {
      setSuccess(null)
      setError(err?.message || String(err))
    },
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

  function confirmDiscardEdit() {
    if (!editDirty) return true
    return window.confirm('Есть несохранённые изменения. Продолжить без сохранения?')
  }

  function beginEditTemplate() {
    if (!selectedTemplate) {
      setError('Выберите шаблон обхода')
      return
    }
    const items = templateToDraftItems(selectedTemplate)
    setError(null)
    setSuccess(null)
    setCreateOpen(false)
    setEditName(selectedTemplate.name || '')
    setEditDescription(selectedTemplate.description || '')
    setEditItems(items)
    setEditBaseline(templateDraftSnapshot(selectedTemplate.name || '', selectedTemplate.description || '', items))
    setEditOpen(true)
  }

  function cancelEditTemplate() {
    if (!confirmDiscardEdit()) return
    setEditOpen(false)
    setEditBaseline('')
  }

  function selectTemplate(templateId: string) {
    if (templateId === selectedTemplateId) return
    if (!confirmDiscardEdit()) return
    setSelectedTemplateId(templateId)
    setEditOpen(false)
    setEditBaseline('')
    setSuccess(null)
  }

  function toggleCreateTemplateForm() {
    if (!createOpen && editOpen && !confirmDiscardEdit()) return
    setCreateOpen((current) => !current)
    if (!createOpen) {
      setEditOpen(false)
      setEditBaseline('')
    }
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Обходы</h2>
          <div className="muted small">Выберите шаблон и запустите обход по точке.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManageTemplates ? (
            <button type="button" className="ghost" onClick={toggleCreateTemplateForm}>
              {createOpen ? 'Скрыть форму' : 'Создать шаблон обхода'}
            </button>
          ) : null}
          <Link to="/inspection/runs"><button className="ghost">История обходов</button></Link>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {success ? (
        <div
          className="panel"
          style={{ marginTop: 10, marginBottom: 12, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534' }}
        >
          {success}
        </div>
      ) : null}
      {templatesQ.isError ? <div className="alert">{(templatesQ.error as any)?.message || String(templatesQ.error)}</div> : null}
      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}

      {createOpen && canManageTemplates ? (
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

            <TemplateItemsEditor
              items={draftItems}
              onChange={setDraftItems}
              categories={templateCategories}
              categoryContextLabel={categoryContextLabel}
            />

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
                  setDraftItems([emptyTemplateDraftItem(), emptyTemplateDraftItem()])
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen && selectedTemplate && canManageTemplates ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Редактирование шаблона</h3>
              <div className="muted small">Изменения применятся к новым обходам. Уже выполненные обходы сохраняют свой снимок чек-листа.</div>
            </div>
            {editDirty ? <span className="tag">Есть изменения</span> : null}
          </div>

          <div className="form">
            <label>
              Название шаблона
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ежедневный обход точки" />
            </label>

            <label>
              Описание
              <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Краткое описание шаблона" />
            </label>

            <TemplateItemsEditor
              items={editItems}
              onChange={setEditItems}
              categories={templateCategories}
              categoryContextLabel={categoryContextLabel}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => updateTemplateM.mutate()} disabled={updateTemplateM.isPending || !editDirty}>
                {updateTemplateM.isPending ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button type="button" className="ghost" onClick={cancelEditTemplate} disabled={updateTemplateM.isPending}>
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
                  onClick={() => selectTemplate(template.id)}
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
                {canManageTemplates ? (
                  <button type="button" className="ghost" onClick={toggleCreateTemplateForm}>
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
          <div className="row" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Запуск обхода</h3>
            {selectedTemplate && canManageTemplates ? (
              <button type="button" className="ghost" onClick={beginEditTemplate}>
                Редактировать
              </button>
            ) : null}
          </div>
          <div className="form">
            <label>
              Шаблон
              <select value={selectedTemplateId} onChange={(e) => selectTemplate(e.target.value)}>
                <option value="">Выберите шаблон</option>
                {activeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>

            {isProviderScope ? (
              <label>
                Клиент (контур)
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

            <label>
              Локация
              <select
                value={locationId}
                onChange={(e) => { setLocationId(e.target.value); setEquipmentId('') }}
                disabled={isProviderScope && !scopeCompanyId}
              >
                <option value="">{isProviderScope && !scopeCompanyId ? 'Сначала выберите клиента' : 'Выберите локацию'}</option>
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
                  <div className="muted small">{run.title} · {run.location.name} · пунктов: {run._count.items}</div>
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
