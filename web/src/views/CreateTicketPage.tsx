import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { CategoryGuidancePanel } from '../components/CategoryGuidancePanel'
import { useCreateTicketFlow, type CreateSuccessResult } from '../hooks/useCreateTicketFlow'
import {
  TICKET_MEDIA_ACCEPT,
  normalizeTicketMediaFile,
  ticketMediaKind,
  ticketMediaNoun,
  validateTicketMediaFile,
} from '../lib/ticketAttachmentMedia'

type SuccessPayload = {
  ticketId: string
  ticketNumber?: number | null
  autoAssigned?: boolean
  generatedTitle?: string
  categoryName: string
  locationName: string
}

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
  const preCreateSnapshotRef = useRef({ categoryName: '', locationName: '' })

  const [mode, setMode] = useState<CreateMode>('quick')
  const [err, setErr] = useState<string | null>(null)
  const [clientCompanyId, setClientCompanyId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [postCreateAction, setPostCreateAction] = useState<'leave_unassigned' | 'assign_employee'>('leave_unassigned')
  const [assignTechnicianId, setAssignTechnicianId] = useState('')
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
  const [successPayload, setSuccessPayload] = useState<SuccessPayload | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const companyQ = useQuery({
    queryKey: ['mobile-shell-company'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'CLIENT' && meQ.data.role !== 'TECHNICIAN',
  })
  const meReady = meQ.isSuccess
  const isTechnician = meReady && meQ.data?.role === 'TECHNICIAN'
  const canCreateByRole = !!meQ.data?.role && CREATE_ALLOWED_ROLES.includes(meQ.data.role)
  const searchFromLocation = useMemo(() => new URLSearchParams(location.search), [location.search])
  const linkedClientCompanyId = useMemo(
    () => (searchFromLocation.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim(),
    [searchFromLocation, meQ.data],
  )
  const observerCompanyId = useMemo(
    () => (searchFromLocation.get('companyId') || api.getObserverCompanyId(meQ.data)).trim(),
    [searchFromLocation, meQ.data],
  )
  const effectiveClientCompanyId = useMemo(() => {
    if (!meReady || !meQ.data) return ''
    const role = meQ.data.role
    if (role === 'CLIENT' || role === 'NETWORK_DIRECTOR') {
      return (meQ.data.companyId || '').trim()
    }
    const linked = linkedClientCompanyId.trim()
    if (linked) return linked
    return (observerCompanyId || '').trim()
  }, [meReady, meQ.data, linkedClientCompanyId, observerCompanyId])
  const providerNeedsLinkedClient =
    !!meQ.data && companyQ.data?.type === 'PROVIDER' && meQ.data.role !== 'TECHNICIAN' && !linkedClientCompanyId
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
  const selectedCreateClientCompanyId = isTechnician ? clientCompanyId : effectiveClientCompanyId

  useEffect(() => {
    api.persistScopeFromSearchParams(new URLSearchParams(location.search), meQ.data)
  }, [location.search, meQ.data])

  const technicianContextsQ = useQuery({
    queryKey: ['technician-bound-contexts', linkedClientCompanyId],
    queryFn: () => api.getTechnicianBoundContexts(linkedClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role === 'TECHNICIAN',
  })
  const categoriesQ = useQuery({
    queryKey: ['problem-categories', effectiveClientCompanyId],
    queryFn: () => api.problemCategories(effectiveClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN',
  })
  const locationsQ = useQuery({
    queryKey: ['locations', effectiveClientCompanyId],
    queryFn: () => api.locations(effectiveClientCompanyId || undefined),
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
    queryKey: ['equipment-by-location', selectedCreateClientCompanyId, locationId],
    queryFn: () => api.equipmentByLocation(locationId, selectedCreateClientCompanyId || undefined),
    enabled: !!locationId,
  })
  const canAssignOnCreate =
    !!meQ.data?.role &&
    companyQ.data?.type === 'PROVIDER' &&
    ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR'].includes(meQ.data.role) &&
    !!selectedCreateClientCompanyId
  const createCandidatesQ = useQuery({
    queryKey: ['create-assignment-candidates', selectedCreateClientCompanyId, locationId, categoryId],
    queryFn: () => api.createAssignmentCandidates({
      clientCompanyId: selectedCreateClientCompanyId || undefined,
      locationId,
      categoryId,
    }),
    enabled: canAssignOnCreate && !!locationId && !!categoryId,
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
  const createAssignmentCandidates = useMemo(
    () => [...(createCandidatesQ.data?.matched || []), ...(createCandidatesQ.data?.others || [])].filter(api.isAssignableCandidate),
    [createCandidatesQ.data],
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

  useEffect(() => {
    if (postCreateAction !== 'assign_employee') {
      setAssignTechnicianId('')
      return
    }
    if (!assignTechnicianId && createAssignmentCandidates.length > 0) {
      setAssignTechnicianId(createAssignmentCandidates[0].id)
      return
    }
    if (assignTechnicianId && !createAssignmentCandidates.some((candidate) => candidate.id === assignTechnicianId)) {
      setAssignTechnicianId(createAssignmentCandidates[0]?.id || '')
    }
  }, [assignTechnicianId, createAssignmentCandidates, postCreateAction])

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
  function handleCreateSuccess(result: CreateSuccessResult) {
    setSuccessPayload({
      ticketId: result.ticketId,
      ticketNumber: result.ticketNumber,
      autoAssigned: result.autoAssigned,
      generatedTitle: result.generatedTitle,
      categoryName: preCreateSnapshotRef.current.categoryName,
      locationName: preCreateSnapshotRef.current.locationName,
    })
  }

  const { createM, submitActionRef } = useCreateTicketFlow({
    isTechnician: !!isTechnician,
    buildTicketLink,
    buildTicketScope,
    setErr,
    onCreateSuccess: handleCreateSuccess,
    clearForNextCreate,
    activeLocations,
    setLocationId,
    setDraftAttachment,
    setDraftAttachmentScopeKey,
    setSelectedFile,
    resetFileInput: () => {
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const file = e.target.files?.[0] || null
    if (!file) {
      setSelectedFile(null)
      return
    }
    const normalized = normalizeTicketMediaFile(file)
    const validationError = validateTicketMediaFile(normalized)
    if (validationError) {
      setSelectedFile(null)
      e.target.value = ''
      setUploadError(validationError)
      return
    }
    setSelectedFile(normalized)
  }

  function buildPayload(): api.CreateTicketInput {
    const base: api.CreateTicketInput = {
      createMode: mode,
      clientCompanyId: isTechnician ? clientCompanyId : (linkedClientCompanyId || observerCompanyId) || undefined,
      postCreateAction: submitActionRef.current === 'createAndClaim'
        ? 'claim_self'
        : canAssignOnCreate
          ? postCreateAction
          : undefined,
      assignTechnicianId: canAssignOnCreate && postCreateAction === 'assign_employee'
        ? assignTechnicianId || undefined
        : undefined,
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
    if (payload.postCreateAction === 'assign_employee' && !payload.assignTechnicianId) {
      return 'Выберите сотрудника для назначения или оставьте заявку без назначения.'
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
    setSuccessPayload(null)
    if (!canCreateByRole) {
      submitActionRef.current = 'create'
      setErr('Эта роль не может создавать заявки')
      return
    }
    const payload = buildPayload()
    const validationError = validatePayload(payload)
    if (validationError) {
      submitActionRef.current = 'create'
      setErr(validationError)
      return
    }
    preCreateSnapshotRef.current = {
      categoryName: selectedCategoryName || '',
      locationName: activeLocations.find((l) => l.id === locationId)?.name || '',
    }
    createM.mutate(payload)
  }

  function onCreateAndClaim() {
    submitActionRef.current = 'createAndClaim'
  }

  function onUpload() {
    if (!selectedFile) {
      setUploadError('Сначала выберите фото или видео')
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
    setPostCreateAction('leave_unassigned')
    setAssignTechnicianId('')
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

      {providerNeedsLinkedClient ? (
        <div className="panel">
          <h3 style={{ marginBottom: 6 }}>Выберите клиентский контур</h3>
          <div className="muted small">Для создания заявки необходимо выбрать клиентский контур. Перейдите на доску и выберите клиента через верхнюю панель.</div>
        </div>
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

      <div className="panel uiCard" style={{ display: (meQ.data && !canCreateByRole) || providerNeedsLinkedClient ? 'none' : 'block' }}>
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

          {canAssignOnCreate ? (
            <div className="panel" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>После создания</div>
              <label>
                Действие
                <select value={postCreateAction} onChange={(e) => setPostCreateAction(e.target.value as 'leave_unassigned' | 'assign_employee')} disabled={isBusy}>
                  <option value="leave_unassigned">Оставить без назначения</option>
                  <option value="assign_employee">Назначить сотруднику</option>
                </select>
              </label>
              {postCreateAction === 'assign_employee' ? (
                <label>
                  Исполнитель
                  <select
                    value={assignTechnicianId}
                    onChange={(e) => setAssignTechnicianId(e.target.value)}
                    disabled={isBusy || createCandidatesQ.isFetching || createAssignmentCandidates.length === 0}
                  >
                    {createAssignmentCandidates.length === 0 ? <option value="">Нет доступных сотрудников</option> : null}
                    {createAssignmentCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {[candidate.firstName, candidate.lastName, candidate.email].filter(Boolean).join(' ') || candidate.id}
                        {candidate.matched ? ' · рекомендован' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {createCandidatesQ.isError ? (
                <div className="alert">{(createCandidatesQ.error as any)?.message || String(createCandidatesQ.error)}</div>
              ) : null}
            </div>
          ) : null}

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
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{mode === 'quick' ? 'Шаг 4. Фото или видео' : 'Фото или видео'}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input ref={fileInputRef} type="file" accept={TICKET_MEDIA_ACCEPT} onChange={handleFileChange} disabled={isBusy || !!draftAttachment} />
              <button type="button" onClick={onUpload} disabled={uploadM.isPending || !selectedFile || !!draftAttachment}>
                {uploadM.isPending ? 'Загружаем...' : draftAttachment ? `${ticketMediaNoun(draftAttachment)} загружено` : 'Загрузить файл'}
              </button>
              {selectedFile ? <div className="muted small">{selectedFile.name}</div> : null}
            </div>

            {draftAttachment ? (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {ticketMediaKind(draftAttachment) === 'video' ? (
                  <video src={api.resolveTicketAttachmentUrl(draftAttachment)} controls preload="metadata" style={{ width: 420, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                ) : (
                  <img src={api.resolveTicketAttachmentUrl(draftAttachment)} alt={draftAttachment.originalName} style={{ width: 260, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                )}
                <div className="muted small">Файл будет привязан к заявке при отправке.</div>
                <div>
                  <button type="button" className="ghost" onClick={() => deleteDraftM.mutate(draftAttachment.id)} disabled={deleteDraftM.isPending}>
                    {deleteDraftM.isPending ? 'Удаляем...' : 'Удалить файл'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="uiActions">
            <button
              type="submit"
              onClick={() => { submitActionRef.current = 'create' }}
              disabled={!canCreateByRole || isBusy || isBootstrapping || noCategories || noLocations || !locationId || (isTechnician && !clientCompanyId)}
            >
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
        </form>
      </div>

      {successPayload ? (
        <div
          className="successDialogBackdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-ticket-success-title"
          onClick={() => setSuccessPayload(null)}
        >
          <div className="successDialogPanel" onClick={(e) => e.stopPropagation()}>
            <div className="successDialogIcon" aria-hidden>✓</div>

            <div id="create-ticket-success-title" className="successDialogTitle">
              Заявка успешно создана
            </div>

            <div className="successDialogNumber">
              {successPayload.ticketNumber != null
                ? `#${successPayload.ticketNumber}`
                : `ID: ${successPayload.ticketId.slice(0, 8)}…`}
            </div>

            <div className="successDialogMeta">
              {successPayload.categoryName ? (
                <div className="successDialogMetaRow">
                  <span className="successDialogMetaLabel">Категория</span>
                  <span className="successDialogMetaValue">{successPayload.categoryName}</span>
                </div>
              ) : null}
              {successPayload.locationName ? (
                <div className="successDialogMetaRow">
                  <span className="successDialogMetaLabel">Локация</span>
                  <span className="successDialogMetaValue">{successPayload.locationName}</span>
                </div>
              ) : null}
              <div className="successDialogMetaRow">
                <span className="successDialogMetaLabel">Статус</span>
                <span className="successDialogMetaValue successDialogStatusBadge">
                  {successPayload.autoAssigned ? 'Назначена' : 'Новая'}
                </span>
              </div>
            </div>

            {successPayload.autoAssigned ? (
              <div className="successDialogAssigned">Техник назначен автоматически</div>
            ) : null}

            {!isTechnician && successPayload.categoryName ? (
              <div style={{ marginTop: 16 }}>
                <CategoryGuidancePanel categoryName={successPayload.categoryName} variant="desktop" stepsOnly />
              </div>
            ) : null}

            <div className="successDialogActions">
              <Link to={buildTicketLink(successPayload.ticketId)} onClick={() => setSuccessPayload(null)}>
                <button type="button">Открыть заявку</button>
              </Link>
              <button type="button" className="ghost" onClick={() => setSuccessPayload(null)}>
                Создать ещё
              </button>
              <Link to={buildBoardLink()} onClick={() => setSuccessPayload(null)}>
                <button type="button" className="ghost">На главную</button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
