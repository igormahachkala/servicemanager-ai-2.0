import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { POST_CREATE_HEADLINE, POST_CREATE_SUBLINE } from '../lib/postCreateTicketGuidance'
import { CategoryGuidancePanel } from '../components/CategoryGuidancePanel'
import { useCreateTicketFlow } from '../hooks/useCreateTicketFlow'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

const CREATE_ALLOWED_ROLES: api.Role[] = [
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TERRITORIAL_MANAGER',
  'CLIENT',
  'TECHNICIAN',
]

type CreateMode = 'quick' | 'full'

function urgencyLabel(value: 'URGENT' | 'NOT_URGENT') {
  return value === 'URGENT' ? 'Срочно' : 'Не срочно'
}

function locationLabel(location: api.LocationListItem) {
  const tail = [location.city, location.address].filter(Boolean).join(' | ')
  return tail ? `${location.name} - ${tail}` : location.name
}

export function CreateTicketPage() {
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [mode, setMode] = useState<CreateMode>('quick')
  const [err, setErr] = useState<string | null>(null)
  const [clientCompanyId, setClientCompanyId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [urgency, setUrgency] = useState<'URGENT' | 'NOT_URGENT'>('NOT_URGENT')
  const [requesterName, setRequesterName] = useState('')
  const [requesterPhone, setRequesterPhone] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [comment, setComment] = useState('')
  const [address, setAddress] = useState('')
  const [pointName, setPointName] = useState('')
  const [slaMinutes, setSlaMinutes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [draftAttachment, setDraftAttachment] = useState<api.DraftTicketAttachment | null>(null)
  const [draftAttachmentScopeKey, setDraftAttachmentScopeKey] = useState('')
  const [lastCreatedTicketId, setLastCreatedTicketId] = useState('')

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const meReady = meQ.isSuccess
  const isTechnician = meReady && meQ.data?.role === 'TECHNICIAN'
  const canCreateByRole = !!meQ.data?.role && CREATE_ALLOWED_ROLES.includes(meQ.data.role)
  const searchFromLocation = useMemo(() => new URLSearchParams(location.search), [location.search])
  const linkedClientCompanyId = useMemo(
    () => (searchFromLocation.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim(),
    [searchFromLocation],
  )
  const observerCompanyId = useMemo(
    () => (searchFromLocation.get('companyId') || api.getObserverCompanyId()).trim(),
    [searchFromLocation],
  )
  const scopedCompanyId = linkedClientCompanyId || observerCompanyId || ''
  const isProviderLinkedCreate = !!linkedClientCompanyId && !isTechnician
  const currentCreateScopeKey = useMemo(() => {
    if (isTechnician) return `technician:${clientCompanyId || 'none'}`
    if (linkedClientCompanyId) return `provider:${linkedClientCompanyId}`
    if (observerCompanyId) return `observer:${observerCompanyId}`
    return 'tenant:self'
  }, [clientCompanyId, isTechnician, linkedClientCompanyId, observerCompanyId])
  const createContextMode = isTechnician
    ? 'technician'
    : linkedClientCompanyId
      ? 'provider'
      : observerCompanyId
        ? 'observer'
        : 'tenant'

  useEffect(() => {
    api.persistScopeFromSearchParams(new URLSearchParams(location.search), meQ.data)
  }, [location.search, meQ.data])

  const technicianContextsQ = useQuery({
    queryKey: ['technician-bound-contexts', linkedClientCompanyId],
    queryFn: () => api.getTechnicianBoundContexts(linkedClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role === 'TECHNICIAN',
  })
  const categoriesQ = useQuery({
    queryKey: ['problem-categories', scopedCompanyId],
    queryFn: () => api.problemCategories(scopedCompanyId || undefined),
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN',
  })
  const locationsQ = useQuery({
    queryKey: ['locations', scopedCompanyId],
    queryFn: () => api.locations(scopedCompanyId || undefined),
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN',
  })
  const technicianFallbackQ = useQuery({
    queryKey: ['technician-fallback-scope', linkedClientCompanyId],
    queryFn: async () => {
      const [locations, categories] = await Promise.all([
        api.locations(linkedClientCompanyId),
        api.problemCategories(linkedClientCompanyId),
      ])
      return { locations, categories }
    },
    enabled:
      meReady &&
      meQ.data?.role === 'TECHNICIAN' &&
      !!linkedClientCompanyId &&
      technicianContextsQ.isSuccess &&
      (technicianContextsQ.data || []).length === 0,
  })
  const equipmentQ = useQuery({
    queryKey: ['equipment-by-location', locationId],
    queryFn: () => api.equipmentByLocation(locationId),
    enabled: !!locationId,
  })

  const technicianContexts = technicianContextsQ.data || []
  const needsTechnicianFallback =
    meReady &&
    meQ.data?.role === 'TECHNICIAN' &&
    !!linkedClientCompanyId &&
    technicianContextsQ.isSuccess &&
    technicianContexts.length === 0
  const fallbackClientCompanyQ = useQuery({
    queryKey: ['company-for-technician-fallback', linkedClientCompanyId],
    queryFn: () => api.company(undefined, linkedClientCompanyId),
    enabled: needsTechnicianFallback && !!linkedClientCompanyId,
  })
  const selectedTechnicianContext = useMemo(
    () => technicianContexts.find((row) => row.clientCompany.id === clientCompanyId) || null,
    [clientCompanyId, technicianContexts],
  )

  const activeCategories = useMemo(() => {
    if (!isTechnician) return (categoriesQ.data || []).filter((row) => row.isActive !== false)
    if (selectedTechnicianContext) return (selectedTechnicianContext.categories || []).filter((row) => row.isActive !== false)
    if (needsTechnicianFallback && technicianFallbackQ.data?.categories && clientCompanyId === linkedClientCompanyId) {
      return (technicianFallbackQ.data.categories || []).filter((row) => row.isActive !== false)
    }
    return []
  }, [
    categoriesQ.data,
    clientCompanyId,
    isTechnician,
    linkedClientCompanyId,
    needsTechnicianFallback,
    selectedTechnicianContext,
    technicianFallbackQ.data,
  ])

  const selectedCategoryName = useMemo(
    () => activeCategories.find((row) => row.id === categoryId)?.name,
    [activeCategories, categoryId],
  )

  const activeLocations = useMemo(() => {
    if (!isTechnician) return (locationsQ.data || []).filter((row) => row.isActive !== false)
    if (selectedTechnicianContext) return (selectedTechnicianContext.locations || []).filter((row) => row.isActive !== false)
    if (needsTechnicianFallback && technicianFallbackQ.data?.locations && clientCompanyId === linkedClientCompanyId) {
      return (technicianFallbackQ.data.locations || []).filter((row) => row.isActive !== false)
    }
    return []
  }, [
    clientCompanyId,
    isTechnician,
    linkedClientCompanyId,
    locationsQ.data,
    needsTechnicianFallback,
    selectedTechnicianContext,
    technicianFallbackQ.data,
  ])

  const locationEquipment = useMemo(
    () => (equipmentQ.data || []).filter((row) => row.locationId === locationId || !row.locationId),
    [equipmentQ.data, locationId],
  )

  useEffect(() => {
    if (!isTechnician) return
    if (linkedClientCompanyId && technicianContexts.some((row) => row.clientCompany.id === linkedClientCompanyId)) {
      if (clientCompanyId !== linkedClientCompanyId) setClientCompanyId(linkedClientCompanyId)
      return
    }
    if (linkedClientCompanyId && technicianContexts.length === 0 && needsTechnicianFallback) {
      if (clientCompanyId !== linkedClientCompanyId) setClientCompanyId(linkedClientCompanyId)
      return
    }
    if (!clientCompanyId && technicianContexts.length > 0) setClientCompanyId(technicianContexts[0].clientCompany.id)
  }, [clientCompanyId, isTechnician, linkedClientCompanyId, technicianContexts, needsTechnicianFallback])

  useEffect(() => {
    if (!meQ.data) return
    const fullName = [meQ.data.firstName?.trim(), meQ.data.lastName?.trim()].filter(Boolean).join(' ').trim()
    if (!requesterName && fullName) setRequesterName(fullName)
  }, [meQ.data, requesterName])

  useEffect(() => {
    if (!categoryId && activeCategories.length > 0) setCategoryId(activeCategories[0].id)
    if (categoryId && !activeCategories.some((row) => row.id === categoryId)) setCategoryId(activeCategories[0]?.id || '')
  }, [activeCategories, categoryId])

  useEffect(() => {
    if (!locationId && activeLocations.length > 0) setLocationId(activeLocations[0].id)
    if (locationId && !activeLocations.some((row) => row.id === locationId)) setLocationId(activeLocations[0]?.id || '')
  }, [activeLocations, locationId])

  useEffect(() => {
    if (!draftAttachment) return
    if (!draftAttachmentScopeKey) return
    if (draftAttachmentScopeKey === currentCreateScopeKey) return
    setDraftAttachment(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploadError('Загруженное фото сброшено: изменился контекст создания заявки.')
  }, [currentCreateScopeKey, draftAttachment, draftAttachmentScopeKey])

  useEffect(() => {
    if (!locationId) {
      setEquipmentId('')
      return
    }
    if (equipmentId && !locationEquipment.some((row) => row.id === equipmentId)) setEquipmentId('')
  }, [locationId, equipmentId, locationEquipment])

  const uploadM = useMutation({
    mutationFn: (file: File) => api.uploadDraftTicketAttachment(file),
    onSuccess: (uploaded) => {
      setErr(null)
      setUploadError(null)
      setDraftAttachment(uploaded)
      setDraftAttachmentScopeKey(currentCreateScopeKey)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (e: any) => setUploadError(e?.message || String(e)),
  })
  const deleteDraftM = useMutation({
    mutationFn: (attachmentId: string) => api.deleteDraftTicketAttachment(attachmentId),
    onSuccess: () => {
      setDraftAttachment(null)
      setDraftAttachmentScopeKey('')
      setUploadError(null)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (e: any) => setUploadError(e?.message || String(e)),
  })
  const { createM, submitActionRef } = useCreateTicketFlow({
    isTechnician: !!isTechnician,
    buildTicketLink,
    buildTicketScope,
    setErr,
    setLastCreatedTicketId,
    clearForNextCreate,
    activeLocations,
    setLocationId,
    setDraftAttachment,
    setDraftAttachmentScopeKey,
    setSelectedFile,
    fileInputRef,
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
    const base: api.CreateTicketInput = {
      createMode: mode,
      clientCompanyId: isTechnician ? clientCompanyId : isProviderLinkedCreate ? linkedClientCompanyId : undefined,
      locationId,
      categoryId,
      requesterName: requesterName.trim() || undefined,
      requesterPhone: requesterPhone.trim() || undefined,
      attachmentIds: draftAttachment ? [draftAttachment.id] : [],
      comment: comment.trim() || undefined,
    }

    if (mode === 'quick') {
      return base
    }

    const parsedSla = Number(slaMinutes)
    return {
      ...base,
      equipmentId: equipmentId || undefined,
      urgency,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      pointName: pointName.trim() || undefined,
      slaMinutes: Number.isFinite(parsedSla) && parsedSla > 0 ? parsedSla : undefined,
    }
  }

  function validatePayload(payload: api.CreateTicketInput) {
    if (!payload.locationId) return 'Выберите локацию'
    if (!payload.categoryId) return 'Выберите категорию'
    if (isTechnician && !payload.clientCompanyId) return 'Не выбран клиентский контур'
    if (!activeLocations.some((row) => row.id === payload.locationId)) {
      return 'Локация не входит в текущий scope. Обновите выбор локации.'
    }
    if (!activeCategories.some((row) => row.id === payload.categoryId)) {
      return 'Категория не входит в текущий scope. Обновите выбор категории.'
    }
    if (payload.attachmentIds?.length) {
      if (!draftAttachment) return 'Фото в форме устарело. Загрузите фото повторно.'
      if (draftAttachmentScopeKey && draftAttachmentScopeKey !== currentCreateScopeKey) {
        setDraftAttachment(null)
        setDraftAttachmentScopeKey('')
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return 'Фото загружено в другом контексте. Загрузите фото заново.'
      }
    }
    return null
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (createM.isPending) return
    setErr(null)
    setLastCreatedTicketId('')
    submitActionRef.current = 'create'
    if (!canCreateByRole) {
      setErr('Эта роль не может создавать заявки')
      return
    }
    const payload = buildPayload()
    const validationError = validatePayload(payload)
    if (validationError) {
      setErr(validationError)
      return
    }
    createM.mutate(payload)
  }

  function onCreateAndClaim() {
    submitActionRef.current = 'createAndClaim'
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
    setTitle('')
    setDescription('')
    setComment('')
    setAddress('')
    setPointName('')
    setSlaMinutes('')
    if (draftAttachment) {
      deleteDraftM.mutate(draftAttachment.id)
    } else {
      setDraftAttachmentScopeKey('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function buildBoardLink() {
    if (linkedClientCompanyId) return `/board?linkedClientCompanyId=${linkedClientCompanyId}`
    if (observerCompanyId) return `/board?companyId=${observerCompanyId}`
    return '/board'
  }

  function buildTicketLink(ticketId: string) {
    if (linkedClientCompanyId) return `/tickets/${ticketId}?linkedClientCompanyId=${linkedClientCompanyId}`
    if (observerCompanyId) return `/tickets/${ticketId}?companyId=${observerCompanyId}`
    return `/tickets/${ticketId}`
  }

  function buildTicketScope(): api.TicketScopeParams | undefined {
    if (linkedClientCompanyId) return { linkedClientCompanyId }
    if (observerCompanyId) return { companyId: observerCompanyId }
    return undefined
  }

  function clearForNextCreate() {
    setErr(null)
    setUploadError(null)
    setDraftAttachment(null)
    setDraftAttachmentScopeKey('')
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setComment('')
    setDescription('')
    setTitle('')
    setAddress('')
    setPointName('')
    setSlaMinutes('')
    setEquipmentId('')
  }

  const isBusy = createM.isPending || uploadM.isPending || deleteDraftM.isPending
  const noCategories = activeCategories.length === 0
  const noLocations = activeLocations.length === 0
  const isBootstrapping =
    !meQ.isSuccess ||
    (meQ.data?.role === 'TECHNICIAN'
      ? technicianContextsQ.isPending || (needsTechnicianFallback && technicianFallbackQ.isPending)
      : categoriesQ.isPending || locationsQ.isPending)
  const noTechnicianContexts =
    isTechnician &&
    technicianContextsQ.isSuccess &&
    technicianContexts.length === 0 &&
    (!linkedClientCompanyId ||
      (technicianFallbackQ.isSuccess &&
        (technicianFallbackQ.data?.locations?.length ?? 0) === 0 &&
        (technicianFallbackQ.data?.categories?.length ?? 0) === 0))

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Создать заявку</h2>
          <div className="muted small">Quick: 4 шага. Full: расширенная форма с комментарием и всеми полями.</div>
        </div>
        <div>
          <Link to={buildBoardLink()}>
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
      {technicianFallbackQ.isError ? (
        <div className="alert">{(technicianFallbackQ.error as any)?.message || String(technicianFallbackQ.error)}</div>
      ) : null}

      {noTechnicianContexts ? (
        <div className="panel">
          <h3 style={{ marginBottom: 6 }}>Нет привязанного клиентского контура</h3>
          <div className="muted small">Для техника не настроены доступные клиентские компании/локации.</div>
        </div>
      ) : null}
      {canCreateByRole && !isBootstrapping && noLocations ? (
        <div className="panel">
          <h3 style={{ marginBottom: 6 }}>Создание заявки заблокировано: нет доступных локаций</h3>
          <div className="muted small">
            {createContextMode === 'provider'
              ? 'Для выбранного linked-client контекста нет доступных точек. Проверьте связи с клиентом и права доступа к локациям.'
              : createContextMode === 'observer'
                ? 'Для выбранной компании в режиме наблюдения нет доступных точек.'
                : createContextMode === 'technician'
                  ? 'Для выбранного клиентского контура техника нет доступных точек.'
                  : 'В текущем tenant-контуре нет доступных точек.'}
          </div>
        </div>
      ) : null}

      {meQ.data && !canCreateByRole ? (
        <div className="panel uiCard">
          <h3 style={{ marginBottom: 6 }}>Создание заявки недоступно</h3>
          <div className="muted small">Роль <b>{meQ.data.role}</b> не имеет `TICKETS_CREATE`.</div>
        </div>
      ) : null}

      <div className="panel uiCard" style={{ display: meQ.data && !canCreateByRole ? 'none' : 'block' }}>
        <form onSubmit={onSubmit} className="form" style={{ maxWidth: 860, position: 'relative' }}>
          {createM.isPending ? (
            <div
              className="panel"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                opacity: 0.72,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                pointerEvents: 'all',
              }}
            >
              Отправляем…
            </div>
          ) : null}
          <div className="uiActions">
            <button type="button" className={mode === 'quick' ? '' : 'ghost'} onClick={() => setMode('quick')} disabled={isBusy}>
              Быстрая заявка
            </button>
            <button type="button" className={mode === 'full' ? '' : 'ghost'} onClick={() => setMode('full')} disabled={isBusy}>
              Полная заявка
            </button>
          </div>

          {mode === 'quick' ? (
            <div className="muted small">Шаги: 1) Локация 2) Категория 3) Контакт 4) Фото + отправка</div>
          ) : null}

          {isTechnician ? (
            <label>
              Клиентская компания *
              <select
                value={clientCompanyId}
                onChange={(e) => setClientCompanyId(e.target.value)}
                disabled={
                  isBootstrapping ||
                  (technicianContexts.length === 0 && !(needsTechnicianFallback && linkedClientCompanyId))
                }
              >
                {technicianContexts.length === 0 && !(needsTechnicianFallback && linkedClientCompanyId) ? (
                  <option value="">Нет доступных компаний</option>
                ) : null}
                {technicianContexts.map((context) => (
                  <option key={context.clientCompany.id} value={context.clientCompany.id}>{context.clientCompany.name}</option>
                ))}
                {needsTechnicianFallback && linkedClientCompanyId && technicianContexts.length === 0 ? (
                  <option value={linkedClientCompanyId}>
                    {fallbackClientCompanyQ.data?.name?.trim() || 'Клиентский контур (linked)'}
                  </option>
                ) : null}
              </select>
            </label>
          ) : null}

          <label>
            {mode === 'quick' ? 'Шаг 1. Локация *' : 'Локация *'}
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={isBootstrapping || noLocations}>
              {noLocations ? <option value="">Локации недоступны для текущего контекста</option> : null}
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>{locationLabel(location)}</option>
              ))}
            </select>
          </label>

          <label>
            {mode === 'quick' ? 'Шаг 2. Категория *' : 'Категория *'}
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isBootstrapping || noCategories}>
              {noCategories ? <option value="">Нет доступных категорий</option> : null}
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          {mode === 'full' ? (
            <>
              <label>
                Оборудование / Asset (опционально)
                <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={!locationId || equipmentQ.isFetching}>
                  <option value="">Без оборудования</option>
                  {locationEquipment.map((equipment) => (
                    <option key={equipment.id} value={equipment.id}>
                      {[equipment.name, equipment.type, equipment.status].filter(Boolean).join(' · ')}
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
              <label>
                Короткий заголовок
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isBusy} />
              </label>
              <label>
                Комментарий / описание
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} disabled={isBusy} />
              </label>
              <label>
                Точка
                <input value={pointName} onChange={(e) => setPointName(e.target.value)} disabled={isBusy} />
              </label>
              <label>
                Адрес
                <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={isBusy} />
              </label>
              <label>
                SLA (минуты)
                <input value={slaMinutes} onChange={(e) => setSlaMinutes(e.target.value)} disabled={isBusy} />
              </label>
            </>
          ) : null}

          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              {mode === 'quick' ? 'Шаг 3. Контактное имя' : 'Контактное имя'}
              <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Кто сообщил о проблеме" disabled={isBusy} />
            </label>
            <label>
              {mode === 'quick' ? 'Шаг 3. Контактный телефон' : 'Контактный телефон'}
              <input value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} placeholder="+7..." disabled={isBusy} />
            </label>
          </div>

          <label>
            Комментарий в заявку (опционально)
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} disabled={isBusy} />
          </label>

          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{mode === 'quick' ? 'Шаг 4. Фото' : 'Фото'}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={isBusy || !!draftAttachment} />
              <button type="button" onClick={onUpload} disabled={uploadM.isPending || !selectedFile || !!draftAttachment}>
                {uploadM.isPending ? 'Загружаем...' : draftAttachment ? 'Фото загружено' : 'Загрузить фото'}
              </button>
              {selectedFile ? <div className="muted small">{selectedFile.name}</div> : null}
            </div>

            {draftAttachment ? (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <img src={api.resolveTicketAttachmentUrl(draftAttachment)} alt={draftAttachment.originalName} style={{ width: 260, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                <div className="muted small">Фото будет привязано к заявке при отправке.</div>
                <div>
                  <button type="button" className="ghost" onClick={() => deleteDraftM.mutate(draftAttachment.id)} disabled={deleteDraftM.isPending}>
                    {deleteDraftM.isPending ? 'Удаляем...' : 'Удалить фото'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="uiActions">
            <button type="submit" disabled={!canCreateByRole || isBusy || isBootstrapping || noCategories || noLocations || !locationId || (isTechnician && !clientCompanyId)}>
              {createM.isPending ? 'Отправляем...' : 'Создать заявку'}
            </button>
            {isTechnician ? (
              <button
                type="submit"
                className="ghost"
                onClick={onCreateAndClaim}
                disabled={!canCreateByRole || isBusy || isBootstrapping || noCategories || noLocations || !locationId || !clientCompanyId}
              >
                {createM.isPending ? 'Создаём и берём...' : 'Создать и взять в работу'}
              </button>
            ) : null}
            <button type="button" className="ghost" onClick={onReset} disabled={isBusy}>
              Сбросить
            </button>
          </div>
          {lastCreatedTicketId ? (
            <div
              className="successDialogBackdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-ticket-success-title"
            >
              <div className="successDialogPanel">
                <div id="create-ticket-success-title" className="successDialogTitle">{POST_CREATE_HEADLINE}</div>
                <p className="successDialogText">{POST_CREATE_SUBLINE}</p>
                {!isTechnician ? (
                  <>
                    <div className="successDialogSubhead">До приезда техника:</div>
                    <CategoryGuidancePanel categoryName={selectedCategoryName} variant="desktop" stepsOnly />
                    <p className="muted small" style={{ marginTop: 12, lineHeight: 1.45 }}>
                      Статус и push/in-app уведомления — в списке уведомлений аккаунта и в карточке заявки.
                    </p>
                  </>
                ) : (
                  <p className="muted small" style={{ marginTop: 10 }}>
                    Заявка создана для выбранного клиента.
                  </p>
                )}
                <div className="successDialogActions">
                  <Link to={buildTicketLink(lastCreatedTicketId)}>
                    <button type="button">Открыть заявку</button>
                  </Link>
                  <Link to={api.appendScopeToPath('/tickets', { companyId: observerCompanyId || undefined, linkedClientCompanyId: linkedClientCompanyId || undefined }, meQ.data)}>
                    <button type="button" className="ghost">
                      Мои заявки
                    </button>
                  </Link>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setLastCreatedTicketId('')
                      clearForNextCreate()
                    }}
                    disabled={isBusy}
                  >
                    Создать ещё
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}
