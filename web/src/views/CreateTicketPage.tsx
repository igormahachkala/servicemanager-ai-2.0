import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import * as api from '../lib/api'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

const QuickRequestSchema = z.object({
  clientCompanyId: z.string().uuid().optional(),
  locationId: z.string().uuid('locationId: uuid'),
  equipmentId: z.string().uuid('equipmentId: uuid').nullable().optional(),
  categoryId: z.string().uuid('categoryId: uuid'),
  urgency: z.enum(['URGENT', 'NOT_URGENT']).optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
})

const CREATE_ALLOWED_ROLES: api.Role[] = [
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'CLIENT',
  'TECHNICIAN',
]

function urgencyLabel(value: 'URGENT' | 'NOT_URGENT') {
  return value === 'URGENT' ? 'Срочно' : 'Не срочно'
}

function locationLabel(location: api.LocationListItem) {
  const tail = [location.city, location.address].filter(Boolean).join(' | ')
  return tail ? `${location.name} - ${tail}` : location.name
}

function buildPreview(category: api.ProblemCategoryListItem | null, location: api.LocationListItem | null) {
  const title = category?.name || 'Категория будет выбрана'
  const locationText = location ? locationLabel(location) : 'Локация будет выбрана'
  const description = category?.instructions?.trim()
    ? `Быстрый запрос по категории "${title}". Локация: ${locationText}. Инструкция категории: ${category.instructions.trim()}.`
    : `Быстрый запрос по категории "${title}". Локация: ${locationText}. Требуется диагностика и подтверждение причины на месте.`

  return { title, description }
}

export function CreateTicketPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [err, setErr] = useState<string | null>(null)
  const [clientCompanyId, setClientCompanyId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [urgency, setUrgency] = useState<'URGENT' | 'NOT_URGENT'>('NOT_URGENT')
  const [requesterName, setRequesterName] = useState('')
  const [requesterPhone, setRequesterPhone] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [draftAttachment, setDraftAttachment] = useState<api.DraftTicketAttachment | null>(null)

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  const isTechnician = meQ.data?.role === 'TECHNICIAN'
  const canCreateByRole = !!meQ.data?.role && CREATE_ALLOWED_ROLES.includes(meQ.data.role)
  const linkedClientCompanyId = (searchParams.get('linkedClientCompanyId') || '').trim()
  const isProviderLinkedCreate = !!linkedClientCompanyId && !isTechnician

  const technicianContextsQ = useQuery({
    queryKey: ['technician-bound-contexts'],
    queryFn: api.getTechnicianBoundContexts,
    enabled: isTechnician,
  })

  const categoriesQ = useQuery({
    queryKey: ['problem-categories', linkedClientCompanyId],
    queryFn: () => api.problemCategories(linkedClientCompanyId || undefined),
    enabled: !isTechnician,
  })

  const locationsQ = useQuery({
    queryKey: ['locations', linkedClientCompanyId],
    queryFn: () => api.locations(linkedClientCompanyId || undefined),
    enabled: !isTechnician,
  })
  const equipmentQ = useQuery({
    queryKey: ['equipment-by-location', locationId],
    queryFn: () => api.equipmentByLocation(locationId),
    enabled: !!locationId,
  })

  const technicianContexts = technicianContextsQ.data || []
  const selectedTechnicianContext = useMemo(
    () => technicianContexts.find((row) => row.clientCompany.id === clientCompanyId) || null,
    [clientCompanyId, technicianContexts],
  )

  const activeCategories = useMemo(() => {
    if (isTechnician) {
      return (selectedTechnicianContext?.categories || []).filter((row) => row.isActive !== false)
    }
    const rows = categoriesQ.data || []
    return rows.filter((row) => row.isActive !== false)
  }, [categoriesQ.data, isTechnician, selectedTechnicianContext])

  const activeLocations = useMemo(() => {
    if (isTechnician) {
      return (selectedTechnicianContext?.locations || []).filter((row) => row.isActive !== false)
    }
    const rows = locationsQ.data || []
    return rows.filter((row) => row.isActive !== false)
  }, [isTechnician, locationsQ.data, selectedTechnicianContext])

  useEffect(() => {
    if (!isTechnician) return
    if (!clientCompanyId && technicianContexts.length > 0) {
      setClientCompanyId(technicianContexts[0].clientCompany.id)
    }
  }, [clientCompanyId, isTechnician, technicianContexts])

  useEffect(() => {
    if (!meQ.data) return
    const fullName = [meQ.data.firstName?.trim(), meQ.data.lastName?.trim()].filter(Boolean).join(' ').trim()
    if (!requesterName && fullName) {
      setRequesterName(fullName)
    }
  }, [meQ.data, requesterName])

  useEffect(() => {
    if (!categoryId && activeCategories.length > 0) {
      setCategoryId(activeCategories[0].id)
    }
    if (categoryId && !activeCategories.some((row) => row.id === categoryId)) {
      setCategoryId(activeCategories[0]?.id || '')
    }
  }, [activeCategories, categoryId])

  useEffect(() => {
    if (!locationId && activeLocations.length > 0) {
      setLocationId(activeLocations[0].id)
    }
    if (locationId && !activeLocations.some((row) => row.id === locationId)) {
      setLocationId(activeLocations[0]?.id || '')
    }
  }, [activeLocations, locationId])

  const selectedCategory = useMemo(() => activeCategories.find((row) => row.id === categoryId) || null, [activeCategories, categoryId])
  const selectedLocation = useMemo(() => activeLocations.find((row) => row.id === locationId) || null, [activeLocations, locationId])
  const locationEquipment = useMemo(() => (equipmentQ.data || []).filter((row) => row.locationId === locationId || !row.locationId), [equipmentQ.data, locationId])
  const preview = useMemo(() => buildPreview(selectedCategory, selectedLocation), [selectedCategory, selectedLocation])

  useEffect(() => {
    if (!locationId) {
      setEquipmentId('')
      return
    }
    if (equipmentId && !locationEquipment.some((row) => row.id === equipmentId)) {
      setEquipmentId('')
    }
  }, [locationId, equipmentId, locationEquipment])

  const uploadM = useMutation({
    mutationFn: (file: File) => api.uploadDraftTicketAttachment(file),
    onSuccess: (uploaded) => {
      setErr(null)
      setUploadError(null)
      setDraftAttachment(uploaded)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (e: any) => {
      setUploadError(e?.message || String(e))
    },
  })

  const deleteDraftM = useMutation({
    mutationFn: (attachmentId: string) => api.deleteDraftTicketAttachment(attachmentId),
    onSuccess: () => {
      setDraftAttachment(null)
      setUploadError(null)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (e: any) => {
      setUploadError(e?.message || String(e))
    },
  })

  const createM = useMutation({
    mutationFn: (payload: api.CreateTicketInput) => api.createTicket(payload),
    onSuccess: async (created) => {
      setErr(null)
      await qc.invalidateQueries({ queryKey: ['board'] })
      await qc.invalidateQueries({ queryKey: ['tickets'] })

      const createdId = api.extractCreatedTicketId(created)
      if (!createdId) {
        setErr(`Не удалось определить id созданной заявки из ответа backend: ${JSON.stringify(created)}`)
        return
      }

      nav(`/tickets/${createdId}`)
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)

    const file = e.target.files?.[0] || null
    if (!file) {
      setSelectedFile(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null)
      e.target.value = ''
      setUploadError('Можно загружать только изображения')
      return
    }

    if (file.size <= 0) {
      setSelectedFile(null)
      e.target.value = ''
      setUploadError('Файл пустой')
      return
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setSelectedFile(null)
      e.target.value = ''
      setUploadError('Изображение слишком большое (максимум 10 МБ)')
      return
    }

    setSelectedFile(file)
  }

  function buildPayload(): api.CreateTicketInput {
    return {
      clientCompanyId: isTechnician ? clientCompanyId : isProviderLinkedCreate ? linkedClientCompanyId : undefined,
      locationId,
      equipmentId: equipmentId || undefined,
      categoryId,
      urgency,
      requesterName: requesterName.trim() || undefined,
      requesterPhone: requesterPhone.trim() || undefined,
      attachmentIds: draftAttachment ? [draftAttachment.id] : [],
    }
  }

  function validatePayload() {
    const parsed = QuickRequestSchema.safeParse(buildPayload())
    if (!parsed.success) {
      setErr(parsed.error.issues.map((issue) => issue.message).join('\n'))
      return null
    }

    return parsed.data as api.CreateTicketInput
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!canCreateByRole) {
      setErr('Эта роль не может создавать заявки по текущей продуктовой модели')
      return
    }

    const payload = validatePayload()
    if (!payload) return

    createM.mutate(payload)
  }

  function onUpload() {
    if (!selectedFile) {
      setUploadError('Сначала выберите фото')
      return
    }

    uploadM.mutate(selectedFile)
  }

  function onReset() {
    setErr(null)
    setUploadError(null)
    setUrgency('NOT_URGENT')

    if (draftAttachment) {
      deleteDraftM.mutate(draftAttachment.id)
    } else {
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const isBusy = createM.isPending || uploadM.isPending || deleteDraftM.isPending
  const noCategories = activeCategories.length === 0
  const noLocations = activeLocations.length === 0
  const isBootstrapping =
    meQ.isFetching ||
    (isTechnician ? technicianContextsQ.isFetching : categoriesQ.isFetching || locationsQ.isFetching)
  const noTechnicianContexts = isTechnician && !technicianContextsQ.isFetching && technicianContexts.length === 0

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Создать заявку</h2>
          <div className="muted small">
            {isTechnician
              ? 'Выберите привязанную клиентскую компанию, локацию и категорию. Заявка будет создана в клиентском контуре.'
              : 'Выберите локацию, категорию и при необходимости приложите фото. Длинное описание не требуется.'}
          </div>
        </div>
        <div>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {uploadError ? <div className="alert">{uploadError}</div> : null}
      {meQ.isError ? <div className="alert">{(meQ.error as any)?.message || String(meQ.error)}</div> : null}
      {technicianContextsQ.isError ? <div className="alert">{(technicianContextsQ.error as any)?.message || String(technicianContextsQ.error)}</div> : null}
      {categoriesQ.isError ? <div className="alert">{(categoriesQ.error as any)?.message || String(categoriesQ.error)}</div> : null}
      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}
      {equipmentQ.isError ? <div className="alert">{(equipmentQ.error as any)?.message || String(equipmentQ.error)}</div> : null}

      {noTechnicianContexts ? (
        <div className="panel">
          <h3 style={{ marginBottom: 6 }}>Нет привязанного клиентского контура</h3>
          <div className="muted small">
            Для техника ещё не настроены клиентские компании или локации, в рамках которых можно создавать заявки.
          </div>
        </div>
      ) : null}

      {meQ.data && !canCreateByRole ? (
        <div className="panel uiCard">
          <h3 style={{ marginBottom: 6 }}>Создание заявки недоступно</h3>
          <div className="muted small">
            Роль <b>{meQ.data.role}</b> не имеет права `TICKETS_CREATE`. Для этой роли доступен только просмотр.
          </div>
        </div>
      ) : null}

      <div className="panel uiCard" style={{ display: meQ.data && !canCreateByRole ? 'none' : 'block' }}>
        <form onSubmit={onSubmit} className="form" style={{ maxWidth: 860 }}>
          {isTechnician && selectedTechnicianContext ? (
            <div className="muted small" style={{ marginBottom: 4 }}>
              Контекст создания: клиентская компания <b>{selectedTechnicianContext.clientCompany.name}</b>.
            </div>
          ) : null}
          {isTechnician ? (
            <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label>
                1. Клиентская компания *
                <select
                  value={clientCompanyId}
                  onChange={(e) => setClientCompanyId(e.target.value)}
                  disabled={technicianContextsQ.isFetching || technicianContexts.length === 0}
                >
                  {technicianContexts.length === 0 ? <option value="">Нет доступных компаний</option> : null}
                  {technicianContexts.map((context) => (
                    <option key={context.clientCompany.id} value={context.clientCompany.id}>
                      {context.clientCompany.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Срочность
                <select value={urgency} onChange={(e) => setUrgency(e.target.value as 'URGENT' | 'NOT_URGENT')}>
                  <option value="NOT_URGENT">{urgencyLabel('NOT_URGENT')}</option>
                  <option value="URGENT">{urgencyLabel('URGENT')}</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              {isTechnician ? '2. Локация клиента *' : '1. Локация *'}
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={isBootstrapping || noLocations}>
                {noLocations ? <option value="">Нет доступных локаций</option> : null}
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationLabel(location)}
                  </option>
                ))}
              </select>
            </label>

            {!isTechnician ? (
              <label>
                Срочность
                <select value={urgency} onChange={(e) => setUrgency(e.target.value as 'URGENT' | 'NOT_URGENT')}>
                  <option value="NOT_URGENT">{urgencyLabel('NOT_URGENT')}</option>
                  <option value="URGENT">{urgencyLabel('URGENT')}</option>
                </select>
              </label>
            ) : null}
          </div>

          <label>
            {isTechnician ? '3. Оборудование / Asset (опционально)' : '2. Оборудование / Asset (опционально)'}
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              disabled={!locationId || equipmentQ.isFetching}
            >
              <option value="">Без оборудования</option>
              {locationEquipment.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {[equipment.name, equipment.type, equipment.status].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
            <div className="muted small" style={{ marginTop: 6 }}>
              {locationId
                ? equipmentQ.isFetching
                  ? 'Загружаем оборудование для выбранной локации...'
                  : locationEquipment.length === 0
                    ? 'Для этой локации оборудование не найдено. Можно создать заявку без оборудования.'
                    : 'Оборудование фильтруется по выбранной локации.'
                : 'Сначала выберите локацию.'}
            </div>
          </label>

          <label>
            {isTechnician ? '4. Категория *' : '3. Категория *'}
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isBootstrapping || noCategories}>
              {noCategories ? <option value="">Нет доступных категорий</option> : null}
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <div className="muted small" style={{ marginTop: 6 }}>
              Backend сам сформирует заголовок и описание по выбранной категории.
            </div>
          </label>

          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              {isTechnician ? '5. Контактное имя' : '4. Контактное имя'}
              <input
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Кто сообщил о проблеме"
                disabled={isBusy}
              />
            </label>
            <label>
              {isTechnician ? '6. Контактный телефон' : '5. Контактный телефон'}
              <input
                value={requesterPhone}
                onChange={(e) => setRequesterPhone(e.target.value)}
                placeholder="+7..."
                disabled={isBusy}
              />
            </label>
          </div>

          {isTechnician && selectedTechnicianContext ? (
            <div className="panel" style={{ padding: 12 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>Контекст техника</div>
              <div style={{ fontWeight: 700 }}>{selectedTechnicianContext.clientCompany.name}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {selectedTechnicianContext.locationScope === 'ALL_COMPANY_LOCATIONS'
                  ? 'Техник может создавать заявки по всем активным локациям этой компании.'
                  : 'Техник может создавать заявки только по привязанным локациям этой компании.'}
              </div>
            </div>
          ) : null}

          <div className="panel" style={{ padding: 12 }}>
            <div className="muted small" style={{ marginBottom: 6 }}>Предпросмотр того, что сформирует backend</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{preview.title}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{preview.description}</div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{isTechnician ? '5. Фото проблемы' : '4. Фото проблемы'}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={isBusy || !!draftAttachment} />
              <button type="button" onClick={onUpload} disabled={uploadM.isPending || !selectedFile || !!draftAttachment}>
                {uploadM.isPending ? 'Загружаем...' : draftAttachment ? 'Фото загружено' : 'Загрузить фото'}
              </button>
              {selectedFile ? <div className="muted small">{selectedFile.name}</div> : null}
              {uploadError && selectedFile ? (
                <button type="button" className="ghost" onClick={onUpload} disabled={uploadM.isPending}>
                  Повторить загрузку
                </button>
              ) : null}
            </div>

            {draftAttachment ? (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <img
                  src={api.resolveFileUrl(draftAttachment.url)}
                  alt={draftAttachment.originalName}
                  style={{ width: 260, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }}
                />
                <div className="muted small">Фото сохранено и будет привязано к заявке при отправке.</div>
                <div>
                  <button type="button" className="ghost" onClick={() => deleteDraftM.mutate(draftAttachment.id)} disabled={deleteDraftM.isPending}>
                    {deleteDraftM.isPending ? 'Удаляем...' : 'Удалить фото'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="uiActions">
            <button type="submit" disabled={!canCreateByRole || isBusy || isBootstrapping || noCategories || noLocations || (isTechnician && !clientCompanyId)}>
              {createM.isPending ? 'Отправляем...' : isTechnician ? '6. Создать заявку' : '5. Отправить заявку'}
            </button>

            <button type="button" className="ghost" onClick={onReset} disabled={isBusy}>
              Сбросить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}