import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

/** Единый текст: нет загруженного draft-фото (не дублировать другими формулировками). */
const PHOTO_REQUIRED_MSG = 'Фото обязательно для создания заявки. Сначала загрузите снимок.'

type CreateResult = {
  ticketId: string
  claimed: boolean
}

export function MobileCreateTicket() {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId()).trim()
  const scope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }

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

  const technicianContextsQ = useQuery({
    queryKey: ['mobile-create-technician-contexts', linkedClientCompanyId],
    queryFn: () => api.getTechnicianBoundContexts(linkedClientCompanyId || undefined),
    enabled: meReady && meQ.data?.role === 'TECHNICIAN',
  })

  const scopedCompanyId = linkedClientCompanyId || companyId || ''
  const categoriesQ = useQuery({
    queryKey: ['mobile-create-categories', scopedCompanyId, isTechnician ? 'tech' : 'tenant'],
    queryFn: () => api.problemCategories(scopedCompanyId || undefined),
    enabled: meReady && meQ.data?.role !== 'TECHNICIAN',
  })
  const locationsQ = useQuery({
    queryKey: ['mobile-create-locations', scopedCompanyId, isTechnician ? 'tech' : 'tenant'],
    queryFn: () => api.locations(scopedCompanyId || undefined),
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
  const [draftAttachment, setDraftAttachment] = useState<api.DraftTicketAttachment | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateResult | null>(null)

  useEffect(() => {
    if (!categoryId && activeCategories.length > 0) setCategoryId(activeCategories[0].id)
    if (categoryId && !activeCategories.some((row) => row.id === categoryId)) setCategoryId(activeCategories[0]?.id || '')
  }, [activeCategories, categoryId])

  useEffect(() => {
    if (!locationId && activeLocations.length > 0) setLocationId(activeLocations[0].id)
    if (locationId && !activeLocations.some((row) => row.id === locationId)) setLocationId(activeLocations[0]?.id || '')
  }, [activeLocations, locationId])

  useEffect(() => {
    setDraftAttachment(null)
    setUploadError(null)
    clearPhotoInputs()
  }, [clientCompanyId, isTechnician, linkedClientCompanyId, companyId])

  const uploadM = useMutation({
    mutationFn: (file: File) => api.uploadDraftTicketAttachment(file),
    onSuccess: (uploaded) => {
      setUploadError(null)
      setError('')
      setDraftAttachment(uploaded)
      clearPhotoInputs()
    },
    onError: (e: any) => {
      setUploadError(e?.message || String(e))
      clearPhotoInputs()
    },
  })

  const deleteDraftM = useMutation({
    mutationFn: (attachmentId: string) => api.deleteDraftTicketAttachment(attachmentId),
    onSuccess: () => {
      setDraftAttachment(null)
      clearPhotoInputs()
      setUploadError(null)
      setError('')
    },
    onError: (e: any) => setUploadError(e?.message || String(e)),
  })

  const createM = useMutation({
    mutationFn: async (shouldClaim: boolean) => {
      if (!draftAttachment) throw new Error(PHOTO_REQUIRED_MSG)
      const payload: api.CreateTicketInput = {
        createMode: 'quick',
        clientCompanyId: isTechnician ? clientCompanyId : linkedClientCompanyId ? linkedClientCompanyId : undefined,
        locationId,
        categoryId,
        description: description.trim() || undefined,
        attachmentIds: [draftAttachment.id],
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

      setError('')
      setResult(created)
      setDescription('')
      setDraftAttachment(null)
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
    const file = e.target.files?.[0] || null
    if (!file) return
    if (!file.type.startsWith('image/')) {
      e.target.value = ''
      setUploadError('Можно загружать только изображения')
      return
    }
    if (file.size <= 0) {
      e.target.value = ''
      setUploadError('Файл пустой')
      return
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      e.target.value = ''
      setUploadError('Изображение слишком большое (максимум 10 МБ)')
      return
    }
    uploadM.mutate(file)
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
    if (!draftAttachment) {
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
    !!draftAttachment &&
    !createM.isPending &&
    !uploadM.isPending &&
    !deleteDraftM.isPending
  const noTechnicianContexts = isTechnician && technicianContextsQ.isSuccess && technicianContexts.length === 0

  const showEmptyLocationsHint = catalogsSettled && !isBootstrapping && activeLocations.length === 0 && !noTechnicianContexts
  const showEmptyCategoriesHint = catalogsSettled && !isBootstrapping && activeCategories.length === 0 && !noTechnicianContexts

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Создать заявку</h1>
        <div className="mobileSubtitle">Укажите точку, категорию и загрузите фото — без снимка отправка недоступна.</div>
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
        <div className="mobileNotice mobileNoticeSuccess">
          Заявка создана: {result.ticketId}
          {result.claimed ? ' (взята в работу)' : ''}.
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
          </label>

          <label className="mobileFormFieldBeforePhoto">
            Описание (опционально)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко опишите проблему" rows={3} />
          </label>

          <div className="mobileCard mobilePhotoCard" style={{ padding: 12, position: 'relative' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото заявки *</div>
            <p className="mobileHint">Снимите камерой или выберите из галереи — файл загрузится сразу после выбора.</p>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="mobilePhotoInputHidden"
              aria-label="Сделать фото камерой"
              onChange={handlePickedImage}
              disabled={!!draftAttachment || uploadM.isPending || createM.isPending}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="mobilePhotoInputHidden"
              aria-label="Выбрать фото из галереи"
              onChange={handlePickedImage}
              disabled={!!draftAttachment || uploadM.isPending || createM.isPending}
            />
            <div className="mobilePhotoSourceRow">
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                disabled={!!draftAttachment || uploadM.isPending || createM.isPending}
                onClick={() => cameraInputRef.current?.click()}
              >
                Сделать фото
              </button>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                disabled={!!draftAttachment || uploadM.isPending || createM.isPending}
                onClick={() => galleryInputRef.current?.click()}
              >
                Выбрать из телефона
              </button>
            </div>
            {uploadM.isPending ? <div className="mobileMeta" style={{ marginTop: 10 }}>Загружаем фото…</div> : null}
            {draftAttachment ? (
              <div className="mobilePhotoPreview" style={{ display: 'grid', gap: 8 }}>
                <img
                  src={api.resolveFileUrl(draftAttachment.url)}
                  alt={draftAttachment.originalName}
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }}
                />
                <button type="button" className="mobileBtn mobileBtnGhost" onClick={() => deleteDraftM.mutate(draftAttachment.id)} disabled={deleteDraftM.isPending}>
                  {deleteDraftM.isPending ? 'Удаляем...' : 'Удалить фото'}
                </button>
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
