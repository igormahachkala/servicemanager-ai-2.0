import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { POST_CREATE_HEADLINE, POST_CREATE_SUBLINE } from '../lib/postCreateTicketGuidance'
import { CategoryGuidancePanel } from '../components/CategoryGuidancePanel'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

/** Единый текст: нет загруженного draft-фото (не дублировать другими формулировками). */
const PHOTO_REQUIRED_MSG = 'Фото обязательно для создания заявки. Сначала загрузите снимок.'

type CreateResult = {
  ticketId: string
  claimed: boolean
  /** Имя категории на момент успешного создания (для подсказок заказчику). */
  categoryNameForGuidance?: string
}

export function MobileCreateTicket() {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const qc = useQueryClient()
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const successRef = useRef<HTMLDivElement | null>(null)

  function clearPhotoInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const meReady = meQ.isSuccess
  const isTechnician = meReady && meQ.data?.role === 'TECHNICIAN'

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
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN',
  })
  const locationsQ = useQuery({
    queryKey: ['mobile-create-locations', effectiveClientCompanyId, isTechnician ? 'tech' : 'tenant'],
    queryFn: () => api.locations(effectiveClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN',
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
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [slaPriority, setSlaPriority] = useState<api.TicketPriority>('NORMAL')
  const [draftAttachments, setDraftAttachments] = useState<api.DraftTicketAttachment[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [draftUploadProgress, setDraftUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateResult | null>(null)

  useEffect(() => {
    if (!result?.ticketId || !successRef.current) return
    const el = successRef.current
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [result?.ticketId])

  useEffect(() => {
    if (!categoryId && activeCategories.length > 0) setCategoryId(activeCategories[0].id)
    if (categoryId && !activeCategories.some((row) => row.id === categoryId)) setCategoryId(activeCategories[0]?.id || '')
  }, [activeCategories, categoryId])

  const selectedCategory = useMemo(
    () => activeCategories.find((row) => row.id === categoryId) || null,
    [activeCategories, categoryId],
  )

  useEffect(() => {
    if (!locationId && activeLocations.length > 0) setLocationId(activeLocations[0].id)
    if (locationId && !activeLocations.some((row) => row.id === locationId)) setLocationId(activeLocations[0]?.id || '')
  }, [activeLocations, locationId])

  useEffect(() => {
    setDraftAttachments([])
    setUploadError(null)
    setDraftUploadProgress(null)
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
        const uploaded = await api.uploadDraftTicketAttachment(files[i])
        setDraftAttachments((prev) => [...prev, uploaded])
      }
    } catch (e: any) {
      setUploadError(e?.message || String(e))
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
        locationId,
        categoryId,
        description: description.trim() || undefined,
        attachmentIds: draftAttachments.map((d) => d.id),
        priority: slaPriority,
      }

      const created = await api.createTicket(payload, scope)
      const createdId = api.extractCreatedTicketId(created)
      if (!createdId) throw new Error('Не удалось определить id созданной заявки')
      if (shouldClaim) {
        await api.claim(createdId, scope)
      }
      return { ticketId: createdId, claimed: shouldClaim }
    },
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await qc.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await qc.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await qc.invalidateQueries({ queryKey: ['board'] })
      await qc.invalidateQueries({ queryKey: ['mobile-notifications'] })

      setError('')
      const categoryNameForGuidance =
        !isTechnician ? activeCategories.find((r) => r.id === categoryId)?.name : undefined
      setResult({ ...created, categoryNameForGuidance })
      setDescription('')
      setSlaPriority('NORMAL')
      setDraftAttachments([])
      clearPhotoInputs()
    },
    onError: (e: any) => {
      setResult(null)
      setError(e?.message || String(e))
    },
  })

  function handlePickedImage(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    setError('')
    const list = e.target.files
    const files = list ? Array.from(list) : []
    e.target.value = ''
    if (files.length === 0) return
    const valid: File[] = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setUploadError('Можно загружать только изображения')
        return
      }
      if (file.size <= 0) {
        setUploadError('Файл пустой')
        return
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setUploadError('Изображение слишком большое (максимум 10 МБ)')
        return
      }
      valid.push(file)
    }
    void uploadDraftFiles(valid)
  }

  function onCreate(shouldClaim: boolean) {
    setError('')
    setResult(null)
    if (!locationId || !categoryId) {
      setError('Выберите локацию и категорию')
      return
    }
    if (isTechnician && !clientCompanyId) {
      setError('Не выбран клиентский контур')
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

  const selectionReady =
    !!locationId &&
    !!categoryId &&
    activeLocations.some((row) => row.id === locationId) &&
    activeCategories.some((row) => row.id === categoryId) &&
    (!isTechnician || !!clientCompanyId)

  const canSubmit =
    selectionReady &&
    draftAttachments.length > 0 &&
    !createM.isPending &&
    !isUploadingDrafts &&
    !deleteDraftM.isPending
  const noTechnicianContexts = isTechnician && technicianContextsQ.isSuccess && technicianContexts.length === 0

  const showEmptyLocationsHint = catalogsSettled && !isBootstrapping && activeLocations.length === 0 && !noTechnicianContexts
  const showEmptyCategoriesHint = catalogsSettled && !isBootstrapping && activeCategories.length === 0 && !noTechnicianContexts

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Создать заявку</h1>
        <div className="mobileSubtitle">Укажите точку, категорию и загрузите фото — без снимков отправка недоступна.</div>
      </div>

      {(locationsQ.isError || categoriesQ.isError || technicianContextsQ.isError) ? (
        <div className="mobileNotice mobileNoticeError">
          {String(
            (locationsQ.error as any)?.message ||
              (categoriesQ.error as any)?.message ||
              (technicianContextsQ.error as any)?.message ||
              'Не удалось загрузить справочники',
          )}
        </div>
      ) : null}
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      {uploadError ? <div className="mobileNotice mobileNoticeError">{uploadError}</div> : null}
      {result ? (
        <div ref={successRef} className="mobileCard mobilePostCreateSuccess">
          <div className="mobilePostCreateSuccessTitle">{POST_CREATE_HEADLINE}</div>
          <p className="mobilePostCreateSuccessSub">{POST_CREATE_SUBLINE}</p>
          {!isTechnician ? (
            <>
              <div className="mobileMeta mobilePostCreateSectionLabel">До приезда техника:</div>
              <CategoryGuidancePanel
                categoryName={result.categoryNameForGuidance}
                variant="mobile"
                stepsOnly
              />
              <p className="mobileMeta mobilePostCreateNotifyHint">
                Статус заявки — в «Мои заявки» и в разделе «Уведомления» на главной.
              </p>
            </>
          ) : (
            <p className="mobileMeta" style={{ marginTop: 8 }}>
              {result.claimed ? 'Заявка создана и закреплена за вами.' : 'Заявка создана для выбранного клиента.'}
            </p>
          )}
          <div className="mobilePostCreateActions">
            <Link to={api.appendScopeToPath(`/m/tickets/${encodeURIComponent(result.ticketId)}`, scope, meQ.data)} className="mobileBtn">
              Открыть заявку
            </Link>
            <Link to={api.appendScopeToPath('/m/my', scope, meQ.data)} className="mobileBtn mobileBtnSecondary">
              Мои заявки
            </Link>
            <button type="button" className="mobileBtn mobileBtnGhost" onClick={() => setResult(null)}>
              Создать ещё
            </button>
          </div>
        </div>
      ) : null}

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
        <form className="mobileForm" onSubmit={(e) => e.preventDefault()}>
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
            Категория *
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isBootstrapping || !activeCategories.length}>
              {activeCategories.length === 0 ? <option value="">—</option> : null}
              {activeCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="mobileFieldHint">По категории подбирается тип работ и исполнитель.</div>
          </label>

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

          <div className="mobileCard mobilePhotoCard" style={{ padding: 12, position: 'relative' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото заявки *</div>
            <p className="mobileHint">Снимите камерой или выберите из галереи — можно несколько; файлы загрузятся после выбора.</p>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="mobilePhotoInputHidden"
              aria-label="Сделать фото камерой"
              onChange={handlePickedImage}
              disabled={isUploadingDrafts || createM.isPending}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="mobilePhotoInputHidden"
              aria-label="Выбрать фото из галереи"
              onChange={handlePickedImage}
              disabled={isUploadingDrafts || createM.isPending}
            />
            <div className="mobilePhotoSourceRow">
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                disabled={isUploadingDrafts || createM.isPending}
                onClick={() => cameraInputRef.current?.click()}
              >
                Сделать фото
              </button>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                disabled={isUploadingDrafts || createM.isPending}
                onClick={() => galleryInputRef.current?.click()}
              >
                Выбрать из телефона
              </button>
            </div>
            {isUploadingDrafts && draftUploadProgress ? (
              <div className="mobileMeta" style={{ marginTop: 10 }}>
                Загружаем фото… {draftUploadProgress.current} из {draftUploadProgress.total}
              </div>
            ) : null}
            {draftAttachments.length > 0 ? (
              <div className="mobilePhotoPreview">
                <div className="mobilePhotoGrid">
                  {draftAttachments.map((d) => (
                    <div key={d.id} className="mobileDraftThumbCell">
                      <img
                        src={api.resolveFileUrl(d.url)}
                        alt={d.originalName || ''}
                        className="mobilePhotoThumb"
                      />
                      <button
                        type="button"
                        className="mobileDraftThumbRemove"
                        aria-label="Удалить фото"
                        disabled={deleteDraftM.isPending || isUploadingDrafts || createM.isPending}
                        onClick={() => deleteDraftM.mutate(d.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mobileFormSubmitStack">
            <button type="button" className="mobileBtn" disabled={!canSubmit} onClick={() => onCreate(false)}>
              {createM.isPending ? 'Создаем...' : 'Создать заявку'}
            </button>
            {isTechnician ? (
              <button type="button" className="mobileBtn mobileBtnGhost" disabled={!canSubmit || !clientCompanyId} onClick={() => onCreate(true)}>
                {createM.isPending ? 'Создаем...' : 'Создать и взять'}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
