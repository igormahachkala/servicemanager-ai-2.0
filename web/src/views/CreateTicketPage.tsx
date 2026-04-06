import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import * as api from '../lib/api'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

const QuickRequestSchema = z.object({
  locationId: z.string().uuid('locationId: uuid'),
  categoryId: z.string().uuid('categoryId: uuid'),
  urgency: z.enum(['URGENT', 'NOT_URGENT']).optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
})

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
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [err, setErr] = useState<string | null>(null)
  const [locationId, setLocationId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [urgency, setUrgency] = useState<'URGENT' | 'NOT_URGENT'>('NOT_URGENT')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [draftAttachment, setDraftAttachment] = useState<api.DraftTicketAttachment | null>(null)

  const categoriesQ = useQuery({
    queryKey: ['problem-categories'],
    queryFn: api.problemCategories,
  })

  const locationsQ = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.locations(),
  })

  const activeCategories = useMemo(() => {
    const rows = categoriesQ.data || []
    return rows.filter((row) => row.isActive !== false)
  }, [categoriesQ.data])

  const activeLocations = useMemo(() => {
    const rows = locationsQ.data || []
    return rows.filter((row) => row.isActive !== false)
  }, [locationsQ.data])

  useEffect(() => {
    if (!categoryId && activeCategories.length > 0) {
      setCategoryId(activeCategories[0].id)
    }
  }, [activeCategories, categoryId])

  useEffect(() => {
    if (!locationId && activeLocations.length > 0) {
      setLocationId(activeLocations[0].id)
    }
  }, [activeLocations, locationId])

  const selectedCategory = useMemo(() => activeCategories.find((row) => row.id === categoryId) || null, [activeCategories, categoryId])
  const selectedLocation = useMemo(() => activeLocations.find((row) => row.id === locationId) || null, [activeLocations, locationId])
  const preview = useMemo(() => buildPreview(selectedCategory, selectedLocation), [selectedCategory, selectedLocation])
  const selectedCategorySpecializations = useMemo(
    () => (selectedCategory?.specializationLinks || []).map((link) => link.specialization.name),
    [selectedCategory],
  )

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

  function buildPayload() {
    return {
      locationId,
      categoryId,
      urgency,
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

    const payload = validatePayload()
    if (!payload) return

    createM.mutate(payload)
  }

  function onUpload() {
    if (!selectedFile) {
      setUploadError('Сначала выбери фото')
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
  const isBootstrapping = categoriesQ.isFetching || locationsQ.isFetching

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Quick Request</h2>
          <div className="muted small">Выбери локацию, категорию и при необходимости приложи фото. Длинное описание не требуется.</div>
        </div>
        <div>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {uploadError ? <div className="alert">{uploadError}</div> : null}
      {categoriesQ.isError ? <div className="alert">{(categoriesQ.error as any)?.message || String(categoriesQ.error)}</div> : null}
      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}

      <div className="panel">
        <form onSubmit={onSubmit} className="form" style={{ maxWidth: 860 }}>
          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>
              1. Локация *
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={locationsQ.isFetching || noLocations}>
                {noLocations ? <option value="">Нет доступных локаций</option> : null}
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationLabel(location)}
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

          <label>
            2. Категория *
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={categoriesQ.isFetching || noCategories}>
              {noCategories ? <option value="">Нет доступных категорий</option> : null}
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <div className="muted small" style={{ marginTop: 6 }}>
              Backend сам сгенерирует title и description по выбранной категории.
            </div>
          </label>

          <div className="panel" style={{ padding: 12 }}>
            <div className="muted small" style={{ marginBottom: 6 }}>Предпросмотр того, что сформирует backend</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{preview.title}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{preview.description}</div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>3. Фото проблемы</div>
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
                <div className="muted small">Фото сохранено и будет привязано к тикету при отправке.</div>
                <div>
                  <button type="button" className="ghost" onClick={() => deleteDraftM.mutate(draftAttachment.id)} disabled={deleteDraftM.isPending}>
                    {deleteDraftM.isPending ? 'Удаляем...' : 'Удалить фото'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" disabled={isBusy || isBootstrapping || noCategories || noLocations}>
              {createM.isPending ? 'Отправляем...' : '4. Отправить заявку'}
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
