import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { CategoryGuidancePanel } from '../components/CategoryGuidancePanel'
import { formatMobileMutationError } from './mobileActionErrors'
import { mobileTicketNavState } from './mobileTicketDisplay'
import { MobilePhotoLightbox } from './MobilePhotoLightbox'
import { mobilePath } from './mobileRoute'
import {
  TICKET_MEDIA_ACCEPT,
  normalizeTicketMediaFile,
  ticketMediaKind,
  validateTicketMediaFile,
} from '../lib/ticketAttachmentMedia'

/** Единый текст: нет загруженного доказательства проблемы. */
const PHOTO_REQUIRED_MSG = 'Фото или видео обязательно для создания заявки. Сначала загрузите файл.'

type CreatedTicketState = {
  ticketId: string
  ticketNumber?: number | null
  claimed: boolean
  claimFailed: boolean
  ticketOwnerCompanyId?: string
  categoryName?: string
  locationName?: string
}

function categoryEligibleForTechnician(cat: api.ProblemCategoryListItem): boolean {
  if (!cat.coverage) return true
  return cat.coverage.status === 'covered'
}

function categoryBlockedTitle(cat: api.ProblemCategoryListItem): string {
  const st = cat.coverage?.status
  if (st === 'no_specializations') {
    return 'Категория требует специализации, которой нет в вашем профиле. Выберите другую категорию.'
  }
  if (st === 'no_technicians') {
    return 'По этой категории в контуре нет доступных исполнителей — создание может быть отклонено.'
  }
  return 'Категория сейчас недоступна для создания заявки с вашей ролью.'
}

export function MobileCreateTicket() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = new URLSearchParams(location.search)
  const qc = useQueryClient()
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  function clearPhotoInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const meReady = meQ.isSuccess
  const isTechnician = meReady && meQ.data?.role === 'TECHNICIAN'
  const companyQ = useQuery({
    queryKey: ['mobile-create-company'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'CLIENT' && meQ.data.role !== 'TECHNICIAN',
  })

  const linkedClientCompanyId = useMemo(
    () => (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim(),
    [location.search, meQ.data],
  )
  const companyId = useMemo(
    () => (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim(),
    [location.search, meQ.data],
  )
  const scope = useMemo(
    () => ({
      linkedClientCompanyId: linkedClientCompanyId || undefined,
      companyId: companyId || undefined,
    }),
    [linkedClientCompanyId, companyId],
  )
  const providerContextKnown =
    !meQ.data || meQ.data.role === 'CLIENT' || meQ.data.role === 'TECHNICIAN' || companyQ.isSuccess || companyQ.isError
  const providerNeedsLinkedClient = !!meQ.data && companyQ.data?.type === 'PROVIDER' && meQ.data.role !== 'TECHNICIAN' && !linkedClientCompanyId

  /** Для GET /locations и GET /problem-categories backend ждёт query `companyId` (клиентский tenant каталога). */
  const effectiveClientCompanyId = useMemo(() => {
    if (!meReady || !meQ.data) return ''
    const role = meQ.data.role
    if (role === 'CLIENT' || role === 'NETWORK_DIRECTOR') {
      return (meQ.data.companyId || '').trim()
    }
    const linked = linkedClientCompanyId.trim()
    if (linked) return linked
    return (companyId || '').trim()
  }, [meReady, meQ.data, linkedClientCompanyId, companyId])

  const technicianContextsQ = useQuery({
    queryKey: ['mobile-create-technician-contexts', linkedClientCompanyId],
    queryFn: () => api.getTechnicianBoundContexts(linkedClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role === 'TECHNICIAN',
  })

  const categoriesQ = useQuery({
    queryKey: ['mobile-create-categories', effectiveClientCompanyId, isTechnician ? 'tech' : 'tenant'],
    queryFn: () => api.problemCategories(effectiveClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN' && providerContextKnown && !providerNeedsLinkedClient,
  })
  const locationsQ = useQuery({
    queryKey: ['mobile-create-locations', effectiveClientCompanyId, isTechnician ? 'tech' : 'tenant'],
    queryFn: () => api.locations(effectiveClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN' && providerContextKnown && !providerNeedsLinkedClient,
  })

  const [clientCompanyId, setClientCompanyId] = useState('')
  const technicianContexts = technicianContextsQ.data || []
  const selectedTechnicianContext = useMemo(
    () => technicianContexts.find((row) => row.clientCompany.id === clientCompanyId) || null,
    [clientCompanyId, technicianContexts],
  )

  useEffect(() => {
    if (!isTechnician) return
    if (!clientCompanyId && technicianContexts.length > 0) {
      const preferred = linkedClientCompanyId
        ? technicianContexts.find((row) => row.clientCompany.id === linkedClientCompanyId)?.clientCompany.id
        : ''
      setClientCompanyId(preferred || technicianContexts[0].clientCompany.id)
    }
  }, [clientCompanyId, isTechnician, linkedClientCompanyId, technicianContexts])

  const activeCategories = useMemo(() => {
    if (isTechnician) return (selectedTechnicianContext?.categories || []).filter((row) => row.isActive !== false)
    return (categoriesQ.data || []).filter((row) => row.isActive !== false)
  }, [categoriesQ.data, isTechnician, selectedTechnicianContext])

  const activeLocations = useMemo(() => {
    if (isTechnician) return (selectedTechnicianContext?.locations || []).filter((row) => row.isActive !== false)
    return (locationsQ.data || []).filter((row) => row.isActive !== false)
  }, [isTechnician, locationsQ.data, selectedTechnicianContext])

  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [postCreateAction, setPostCreateAction] = useState<'leave_unassigned' | 'assign_employee'>('leave_unassigned')
  const [assignTechnicianId, setAssignTechnicianId] = useState('')
  const [description, setDescription] = useState('')
  const [urgencyReason, setUrgencyReason] = useState('')
  const [slaPriority, setSlaPriority] = useState<api.TicketPriority>('NORMAL')
  const [draftAttachments, setDraftAttachments] = useState<api.DraftTicketAttachment[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [draftUploadProgress, setDraftUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [createdTicket, setCreatedTicket] = useState<CreatedTicketState | null>(null)
  const [photoPreview, setPhotoPreview] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    if (!categoryId && activeCategories.length > 0) setCategoryId(activeCategories[0].id)
    if (categoryId && !activeCategories.some((row) => row.id === categoryId)) setCategoryId(activeCategories[0]?.id || '')
  }, [activeCategories, categoryId])

  useEffect(() => {
    if (!isTechnician) return
    const sel = activeCategories.find((row) => row.id === categoryId)
    if (sel && categoryEligibleForTechnician(sel)) return
    const firstOk = activeCategories.find((row) => categoryEligibleForTechnician(row))
    if (firstOk) setCategoryId(firstOk.id)
  }, [isTechnician, activeCategories, categoryId])

  const selectedCategory = useMemo(
    () => activeCategories.find((row) => row.id === categoryId) || null,
    [activeCategories, categoryId],
  )
  const selectedCreateClientCompanyId = isTechnician ? clientCompanyId : effectiveClientCompanyId

  const equipmentQ = useQuery({
    queryKey: ['mobile-create-equipment', selectedCreateClientCompanyId, locationId],
    queryFn: () => api.equipmentByLocation(locationId, selectedCreateClientCompanyId || undefined),
    enabled: !!locationId && !!selectedCreateClientCompanyId,
  })
  const locationEquipment = useMemo(
    () => (equipmentQ.data || []).filter((row) => row.locationId === locationId || !row.locationId),
    [equipmentQ.data, locationId],
  )
  const canAssignOnCreate =
    !!meQ.data?.role &&
    companyQ.data?.type === 'PROVIDER' &&
    ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR'].includes(meQ.data.role) &&
    !!selectedCreateClientCompanyId
  const createCandidatesQ = useQuery({
    queryKey: ['mobile-create-assignment-candidates', selectedCreateClientCompanyId, locationId, categoryId],
    queryFn: () => api.createAssignmentCandidates({
      clientCompanyId: selectedCreateClientCompanyId || undefined,
      locationId,
      categoryId,
    }),
    enabled: canAssignOnCreate && !!locationId && !!categoryId,
  })
  const createAssignmentCandidates = useMemo(
    () => [...(createCandidatesQ.data?.matched || []), ...(createCandidatesQ.data?.others || [])],
    [createCandidatesQ.data],
  )

  useEffect(() => {
    if (!locationId && activeLocations.length > 0) setLocationId(activeLocations[0].id)
    if (locationId && !activeLocations.some((row) => row.id === locationId)) setLocationId(activeLocations[0]?.id || '')
  }, [activeLocations, locationId])

  useEffect(() => {
    if (!locationId) {
      setEquipmentId('')
      return
    }
    if (equipmentId && !locationEquipment.some((row) => row.id === equipmentId)) setEquipmentId('')
  }, [equipmentId, locationEquipment, locationId])

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

  useEffect(() => {
    setDraftAttachments([])
    setUploadError(null)
    setDraftUploadProgress(null)
    setPhotoPreview(null)
    clearPhotoInputs()
  }, [clientCompanyId, isTechnician, linkedClientCompanyId, companyId])

  const isUploadingDrafts = draftUploadProgress !== null

  async function uploadDraftFiles(files: File[]) {
    if (files.length === 0) return
    setUploadError(null)
    setError('')
    setDraftUploadProgress({ current: 0, total: files.length })
    try {
      for (let i = 0; i < files.length; i++) {
        setDraftUploadProgress({ current: i + 1, total: files.length })
        const uploaded = await api.uploadDraftTicketAttachment(normalizeTicketMediaFile(files[i]))
        setDraftAttachments((prev) => [...prev, uploaded])
      }
    } catch (e: any) {
      setUploadError(formatMobileMutationError(e, { operation: 'upload_attachment' }))
    } finally {
      setDraftUploadProgress(null)
      clearPhotoInputs()
    }
  }

  const deleteDraftM = useMutation({
    mutationFn: (attachmentId: string) => api.deleteDraftTicketAttachment(attachmentId),
    onSuccess: (_data, attachmentId) => {
      setDraftAttachments((prev) => prev.filter((d) => d.id !== attachmentId))
      clearPhotoInputs()
      setUploadError(null)
      setError('')
    },
    onError: (e: any) => setUploadError(e?.message || String(e)),
  })

  const createM = useMutation({
    mutationFn: async (shouldClaim: boolean) => {
      if (draftAttachments.length === 0) throw new Error(PHOTO_REQUIRED_MSG)
      const payload: api.CreateTicketInput = {
        createMode: 'quick',
        clientCompanyId: isTechnician ? clientCompanyId : linkedClientCompanyId ? linkedClientCompanyId : undefined,
        postCreateAction: shouldClaim ? 'claim_self' : canAssignOnCreate ? postCreateAction : undefined,
        assignTechnicianId: canAssignOnCreate && postCreateAction === 'assign_employee' ? assignTechnicianId || undefined : undefined,
        locationId,
        equipmentId: equipmentId || undefined,
        categoryId,
        description: description.trim() || undefined,
        urgencyReason: urgencyReason.trim() || undefined,
        attachmentIds: draftAttachments.map((d) => d.id),
        priority: slaPriority,
      }

      const created = await api.createTicket(payload, scope)
      const createdId = api.extractCreatedTicketId(created)
      if (!createdId) throw new Error('Не удалось определить id созданной заявки')
      return {
        ticketId: createdId,
        ticketNumber: created.ticket?.ticketNumber,
        claimed: shouldClaim,
        claimFailed: false as const,
      }
    },
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await qc.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await qc.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await qc.invalidateQueries({ queryKey: ['board'] })
      await qc.invalidateQueries({ queryKey: ['mobile-notifications'] })

      setError('')
      setDescription('')
      setSlaPriority('NORMAL')
      setEquipmentId('')
      setPostCreateAction('leave_unassigned')
      setAssignTechnicianId('')
      setDraftAttachments([])
      setPhotoPreview(null)
      clearPhotoInputs()

      const ticketOwnerForNav = isTechnician
        ? (clientCompanyId || '').trim()
        : (linkedClientCompanyId || effectiveClientCompanyId || '').trim() || undefined
      setCreatedTicket({
        ticketId: created.ticketId,
        ticketNumber: created.ticketNumber,
        claimed: created.claimed,
        claimFailed: created.claimFailed,
        ticketOwnerCompanyId: ticketOwnerForNav,
        categoryName: selectedCategory?.name || undefined,
        locationName: activeLocations.find((row) => row.id === locationId)?.name || undefined,
      })
    },
    onError: (e: unknown) => {
      setError(formatMobileMutationError(e, { operation: 'create_ticket' }))
    },
  })

  function handlePickedMedia(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    setError('')
    const list = e.target.files
    const files = list ? Array.from(list) : []
    e.target.value = ''
    if (files.length === 0) return
    const valid: File[] = []
    for (const rawFile of files) {
      const file = normalizeTicketMediaFile(rawFile)
      const validationError = validateTicketMediaFile(file)
      if (validationError) {
        setUploadError(validationError)
        return
      }
      valid.push(file)
    }
    void uploadDraftFiles(valid)
  }

  function onCreate(shouldClaim: boolean) {
    setError('')
    if (!locationId || !categoryId) {
      setError('Выберите локацию и категорию')
      return
    }
    if (isTechnician && !clientCompanyId) {
      setError('Не выбран клиентский контур')
      return
    }
    if (canAssignOnCreate && postCreateAction === 'assign_employee' && !assignTechnicianId) {
      setError('Выберите сотрудника для назначения или оставьте заявку без назначения.')
      return
    }
    if (draftAttachments.length === 0) {
      setError(PHOTO_REQUIRED_MSG)
      return
    }
    createM.mutate(shouldClaim)
  }

  const isBootstrapping =
    !meReady ||
    (meQ.data?.role === 'TECHNICIAN' ? technicianContextsQ.isPending : locationsQ.isPending || categoriesQ.isPending)

  const catalogsSettled =
    meReady &&
    (meQ.data?.role === 'TECHNICIAN'
      ? technicianContextsQ.isFetched
      : locationsQ.isFetched && categoriesQ.isFetched)

  const selectedCategoryEligible = !selectedCategory || !isTechnician || categoryEligibleForTechnician(selectedCategory)

  const selectionReady =
    !!locationId &&
    !!categoryId &&
    activeLocations.some((row) => row.id === locationId) &&
    activeCategories.some((row) => row.id === categoryId) &&
    (!isTechnician || !!clientCompanyId) &&
    selectedCategoryEligible

  const canSubmit =
    selectionReady &&
    draftAttachments.length > 0 &&
    !createM.isPending &&
    !isUploadingDrafts &&
    !deleteDraftM.isPending
  const noTechnicianContexts = isTechnician && technicianContextsQ.isSuccess && technicianContexts.length === 0
  const providerGuardActive = providerNeedsLinkedClient && providerContextKnown

  if (providerGuardActive) {
    return (
      <div className="mobileSection">
        <div>
          <h1 className="mobileTitle">Создать заявку</h1>
          <div className="mobileSubtitle">Укажите точку, категорию и загрузите фото — без снимков отправка недоступна.</div>
        </div>
        <div className="mobileNotice" role="status">
          Выберите клиентский контур в верхней панели перед созданием заявки.
        </div>
      </div>
    )
  }

  const showEmptyLocationsHint = catalogsSettled && !isBootstrapping && activeLocations.length === 0 && !noTechnicianContexts
  const showEmptyCategoriesHint = catalogsSettled && !isBootstrapping && activeCategories.length === 0 && !noTechnicianContexts

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Создать заявку</h1>
        <div className="mobileSubtitle">Укажите точку, категорию и загрузите фото — без снимков отправка недоступна.</div>
      </div>

      {(locationsQ.isError || categoriesQ.isError || technicianContextsQ.isError || equipmentQ.isError || createCandidatesQ.isError) ? (
        <div className="mobileNotice mobileNoticeError">
          {String(
            (locationsQ.error as any)?.message ||
              (categoriesQ.error as any)?.message ||
              (technicianContextsQ.error as any)?.message ||
              (equipmentQ.error as any)?.message ||
              (createCandidatesQ.error as any)?.message ||
              'Не удалось загрузить справочники',
          )}
        </div>
      ) : null}
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      {uploadError ? <div className="mobileNotice mobileNoticeError">{uploadError}</div> : null}
      {noTechnicianContexts ? (
        <div className="mobileNotice mobileNoticeError">
          Нет привязанного клиентского контура для техника. Проверьте привязку к точкам и linked-scope.
        </div>
      ) : null}

      {showEmptyLocationsHint ? (
        <div className="mobileNotice mobileNoticeError">Нет доступных точек. Проверьте привязку к точкам.</div>
      ) : null}
      {showEmptyCategoriesHint ? (
        <div className="mobileNotice mobileNoticeError">Нет доступных категорий для этой компании.</div>
      ) : null}

      <div className="mobileCard">
        <form className="mobileForm mobileCreateForm" data-mobile-tour="create-form" onSubmit={(e) => e.preventDefault()}>
          {isTechnician ? (
            <label>
              Клиентская компания *
              <select
                value={clientCompanyId}
                onChange={(e) => setClientCompanyId(e.target.value)}
                disabled={isBootstrapping || technicianContexts.length === 0}
              >
                {technicianContexts.length === 0 ? <option value="">Нет доступных компаний</option> : null}
                {technicianContexts.map((context) => (
                  <option key={context.clientCompany.id} value={context.clientCompany.id}>
                    {context.clientCompany.name}
                  </option>
                ))}
              </select>
              <div className="mobileFieldHint">Каталог точек и категорий подставится для выбранного клиента.</div>
            </label>
          ) : null}

          <label>
            Локация *
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={isBootstrapping || !activeLocations.length}>
              {activeLocations.length === 0 ? <option value="">—</option> : null}
              {activeLocations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="mobileFieldHint">Точка клиента, к которой относится поломка.</div>
          </label>

          <label>
            Оборудование
            <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={!locationId || equipmentQ.isFetching}>
              <option value="">Без оборудования</option>
              {locationEquipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.name, item.type, item.status].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
            <div className="mobileFieldHint">Если поломка относится к конкретному оборудованию, выберите его из списка точки.</div>
          </label>

          <label>
            Категория *
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isBootstrapping || !activeCategories.length}>
              {activeCategories.length === 0 ? <option value="">—</option> : null}
              {activeCategories.map((item) => {
                const blocked = isTechnician && !categoryEligibleForTechnician(item)
                return (
                  <option key={item.id} value={item.id} disabled={blocked} title={blocked ? categoryBlockedTitle(item) : undefined}>
                    {item.name}
                    {blocked ? ' — недоступно' : ''}
                  </option>
                )
              })}
            </select>
            <div className="mobileFieldHint">По категории подбирается тип работ и исполнитель.</div>
          </label>

          {canAssignOnCreate ? (
            <div className="mobileCard" style={{ padding: 12 }}>
              <label>
                После создания
                <select value={postCreateAction} onChange={(e) => setPostCreateAction(e.target.value as 'leave_unassigned' | 'assign_employee')} disabled={createM.isPending}>
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
                    disabled={createM.isPending || createCandidatesQ.isFetching || createAssignmentCandidates.length === 0}
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
            </div>
          ) : null}

          {!isTechnician && selectedCategory?.name ? (
            <CategoryGuidancePanel categoryName={selectedCategory.name} variant="mobile" />
          ) : null}

          <label>
            Срочность (SLA)
            <select value={slaPriority} onChange={(e) => setSlaPriority(e.target.value as api.TicketPriority)} disabled={createM.isPending}>
              <option value="NORMAL">Не срочно (ответ до 24 ч)</option>
              <option value="URGENT">Срочно (ответ до 2 ч)</option>
            </select>
            <div className="mobileFieldHint">Влияет на целевое время первого ответа по заявке.</div>
          </label>

          <label className="mobileFormFieldBeforePhoto">
            Описание (опционально)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко опишите проблему" rows={3} />
          </label>

          <label className="mobileFormFieldBeforePhoto">
            Причина срочности (опционально)
            <textarea value={urgencyReason} onChange={(e) => setUrgencyReason(e.target.value)} placeholder="Почему срочно? Какой конкретно риск?" rows={2} />
          </label>

          <div className="mobileCard mobilePhotoCard" data-mobile-tour="photo-upload" style={{ padding: 12, position: 'relative' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото или видео заявки *</div>
            <p className="mobileHint">Снимите камерой или выберите из галереи — можно несколько файлов; они загрузятся после выбора.</p>
            <input
              ref={cameraInputRef}
              type="file"
              accept={TICKET_MEDIA_ACCEPT}
              capture="environment"
              className="mobilePhotoInputHidden"
              aria-label="Снять фото или видео камерой"
              onChange={handlePickedMedia}
              disabled={isUploadingDrafts || createM.isPending}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept={TICKET_MEDIA_ACCEPT}
              multiple
              className="mobilePhotoInputHidden"
              aria-label="Выбрать фото или видео из галереи"
              onChange={handlePickedMedia}
              disabled={isUploadingDrafts || createM.isPending}
            />
            <div className="mobilePhotoSourceRow">
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                disabled={isUploadingDrafts || createM.isPending}
                onClick={() => cameraInputRef.current?.click()}
              >
                <span className="mobilePhotoSourceBtnIcon" aria-hidden>
                  {/* Tabler camera */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 7h2l2 -2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </span>
                Снять фото/видео
              </button>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                disabled={isUploadingDrafts || createM.isPending}
                onClick={() => galleryInputRef.current?.click()}
              >
                <span className="mobilePhotoSourceBtnIcon" aria-hidden>
                  {/* Tabler photo */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="15" y1="8" x2="15.01" y2="8" />
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <path d="M4 15l4 -4a3 5 0 0 1 3 0l5 5" />
                    <path d="M14 14l1 -1a3 5 0 0 1 3 0l2 2" />
                  </svg>
                </span>
                Выбрать файл
              </button>
            </div>
            {isUploadingDrafts && draftUploadProgress ? (
              <div className="mobileMeta" style={{ marginTop: 10 }}>
                Загружаем файлы… {draftUploadProgress.current} из {draftUploadProgress.total}
              </div>
            ) : null}
            {draftAttachments.length > 0 ? (
              <div className="mobileCreateDraftList">
                {draftAttachments.map((d) => {
                  const src = api.resolveTicketAttachmentUrl(d)
                  const alt = d.filename || d.originalName || 'Медиафайл'
                  const isVideo = ticketMediaKind(d) === 'video'
                  return (
                    <div key={d.id} className="mobileCreateDraftItem">
                      {src && isVideo ? (
                        <video src={src} controls preload="metadata" className="mobileCreateDraftImg" aria-label={alt} />
                      ) : src ? (
                        <button
                          type="button"
                          className="mobileCreateDraftImgBtn"
                          aria-label={`Просмотр: ${alt}`}
                          onClick={() => setPhotoPreview({ src, alt })}
                        >
                          <img src={src} alt={alt} className="mobileCreateDraftImg" />
                        </button>
                      ) : (
                        <div className="mobileCreateDraftEmpty">Нет превью</div>
                      )}
                      <button
                        type="button"
                        className="mobileCreateDraftRemove"
                        aria-label="Удалить файл"
                        disabled={deleteDraftM.isPending || isUploadingDrafts || createM.isPending}
                        onClick={() => deleteDraftM.mutate(d.id)}
                      >
                        {/* Tabler x */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="mobileFormSubmitStack">
            <button type="button" className="mobileBtn" data-mobile-tour="submit-ticket" disabled={!canSubmit || createM.isPending} onClick={() => onCreate(false)}>
              {createM.isPending ? 'Создаём…' : 'Создать заявку'}
            </button>
            {isTechnician ? (
              <button
                type="button"
                className="mobileBtn mobileBtnGhost"
                disabled={!canSubmit || !clientCompanyId || createM.isPending}
                onClick={() => onCreate(true)}
              >
                {createM.isPending ? 'Создаём…' : 'Создать и взять'}
              </button>
            ) : null}
          </div>
        </form>
      </div>
      {createdTicket ? (
        <div
          className="successDialogBackdrop successDialogBackdropMobile"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-create-ticket-success-title"
        >
          <div className="successDialogPanel successDialogPanelMobile">
            <div id="mobile-create-ticket-success-title" className="successDialogTitle">Заявка создана</div>
            <div className="successDialogTicket">
              {createdTicket.ticketNumber ? `Заявка #${createdTicket.ticketNumber}` : 'Заявка создана'}
            </div>
            <div className="successDialogMeta">
              <div>{createdTicket.categoryName || 'Без категории'}</div>
              <div>{createdTicket.locationName || 'Без локации'}</div>
            </div>
            <p className="successDialogText">
              {createdTicket.claimFailed
                ? 'Заявка создана, но закрепить её за собой не удалось. Откройте карточку и нажмите «Взять заявку» или запросите назначение.'
                : createdTicket.claimed
                  ? 'Заявка создана и закреплена за вами.'
                  : 'Заявка сохранена и доступна в списке.'}
            </p>
            <div className="successDialogActions successDialogActionsMobile">
              <button
                type="button"
                onClick={() => {
                  const path = api.appendScopeToPath(mobilePath(location.pathname, `/tickets/${encodeURIComponent(createdTicket.ticketId)}`), scope, meQ.data)
                  navigate(path, {
                    state: mobileTicketNavState(
                      createdTicket.claimed ? 'my' : 'home',
                      createdTicket.ticketOwnerCompanyId,
                    ),
                  })
                }}
              >
                Открыть заявку
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  navigate(api.appendScopeToPath(mobilePath(location.pathname, '/my'), scope, meQ.data))
                }}
              >
                Мои заявки
              </button>
              <button type="button" className="ghost" onClick={() => setCreatedTicket(null)}>
                Создать ещё
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MobilePhotoLightbox preview={photoPreview} onClose={() => setPhotoPreview(null)} />
    </div>
  )
}
