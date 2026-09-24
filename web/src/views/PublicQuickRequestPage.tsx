import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

type RequestType = 'repair' | 'note'

function locationLabel(location: api.PublicRequestLocation) {
  const parts = [location.city, location.externalCode || location.platformCode, location.name].filter(Boolean)
  return parts.join(' · ')
}

function equipmentLabel(item: api.PublicRequestEquipment) {
  return [item.name, item.type].filter(Boolean).join(' · ')
}

function nextFrameScroll(target: HTMLElement | null) {
  if (!target) return
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

export function PublicQuickRequestPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetLocationId = (searchParams.get('locationId') || '').trim()

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [locationId, setLocationId] = useState('')
  const [requestType, setRequestType] = useState<RequestType>('repair')
  const [equipmentId, setEquipmentId] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<File[]>([])

  const typeRef = useRef<HTMLDivElement | null>(null)
  const detailsRef = useRef<HTMLDivElement | null>(null)

  const contextQ = useQuery({
    queryKey: ['public-request-context', token, presetLocationId],
    queryFn: () => api.publicRequestContext(token, presetLocationId || null),
    enabled: !!token,
  })

  const locationsQ = useQuery({
    queryKey: ['public-request-locations', token, deferredSearch],
    queryFn: () => api.publicRequestLocations(token, deferredSearch),
    enabled: !!token,
  })

  const presetLocation = contextQ.data?.presetLocation || null
  const presetLocked = !!presetLocation && contextQ.data?.presetLocationMode !== 'ALWAYS_OPTIONAL'

  useEffect(() => {
    if (presetLocation?.id) {
      setLocationId(presetLocation.id)
      return
    }
    if (!locationId && locationsQ.data?.length) {
      setLocationId(locationsQ.data[0].id)
    }
  }, [presetLocation, locationsQ.data, locationId])

  useEffect(() => {
    if (contextQ.data?.defaultRequestType) {
      setRequestType(contextQ.data.defaultRequestType)
    }
  }, [contextQ.data?.defaultRequestType])

  const selectedLocation = useMemo(() => {
    if (presetLocation && locationId === presetLocation.id) return presetLocation
    return (locationsQ.data || []).find((item) => item.id === locationId) || presetLocation || null
  }, [locationsQ.data, locationId, presetLocation])

  const equipmentQ = useQuery({
    queryKey: ['public-request-equipment', token, locationId],
    queryFn: () => api.publicRequestLocationEquipment(token, locationId),
    enabled: !!token && !!locationId && (selectedLocation?.equipmentCount || 0) > 0,
  })

  useEffect(() => {
    if (!selectedLocation || (selectedLocation.equipmentCount || 0) === 0) {
      setEquipmentId('')
    }
  }, [selectedLocation])

  const maxPhotos = contextQ.data?.featureFlags.photoUpload ? Math.max(0, contextQ.data?.limits.maxPhotos || 0) : 0
  const requirePhone = contextQ.data?.limits.requirePhone !== false

  const submitM = useMutation({
    mutationFn: () =>
      api.submitPublicQuickRequest(
        token,
        {
          locationId,
          equipmentId: equipmentId || null,
          requestType,
          description: description.trim(),
          phone: phone.trim() || undefined,
          name: name.trim() || undefined,
          presetLocationId: presetLocationId || presetLocation?.id || undefined,
          channel: presetLocation && locationId === presetLocation.id ? 'qr' : 'direct_link',
          publicLinkVersion: 'v2',
        },
        photos,
      ),
    onSuccess: (result) => {
      const params = new URLSearchParams()
      params.set('ticketId', result.ticketId)
      if (result.ticketNumber) params.set('ticketNumber', result.ticketNumber)
      if (contextQ.data?.companyName) params.set('companyName', contextQ.data.companyName)
      navigate('/r/' + token + '/success?' + params.toString())
    },
    onError: (err: any) => setError(err?.message || 'Не удалось отправить заявку'),
  })

  const previews = useMemo(() => photos.map((file) => ({ file, url: URL.createObjectURL(file) })), [photos])

  useEffect(() => {
    return () => {
      for (const preview of previews) URL.revokeObjectURL(preview.url)
    }
  }, [previews])

  function onChoosePhotos(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const selected = Array.from(event.target.files || [])
    if (!selected.length || maxPhotos <= 0) return

    const next = [...photos]
    for (const file of selected) {
      if (!file.type.startsWith('image/')) {
        setError('Можно добавить только фотографии.')
        continue
      }
      if (next.length >= maxPhotos) break
      next.push(file)
    }

    setPhotos(next.slice(0, maxPhotos))
    event.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos((items) => items.filter((_, current) => current !== index))
  }

  function validateAndSubmit() {
    setError(null)
    if (!locationId) {
      setError('Выберите точку обслуживания.')
      return
    }
    if (!description.trim() || description.trim().length < 3) {
      setError('Коротко опишите проблему или наблюдение.')
      return
    }
    if (requirePhone && (!phone.trim() || phone.trim().length < 5)) {
      setError('Укажите телефон для обратной связи.')
      return
    }
    submitM.mutate()
  }

  const busy = contextQ.isLoading || locationsQ.isLoading || submitM.isPending

  return (
    <div className="page" style={{ paddingBottom: 'calc(112px + env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div className="card" style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div className="muted small">Быстрая заявка</div>
          <h1 style={{ margin: 0 }}>{contextQ.data?.companyName || 'Загрузка...'}</h1>
          <div className="muted">
            {contextQ.data?.introText || 'Откройте заявку без логина: выберите точку, коротко опишите ситуацию и оставьте телефон.'}
          </div>
        </div>

        {error ? <div className="alert">{error}</div> : null}
        {contextQ.isError ? <div className="alert">{(contextQ.error as any)?.message || 'Не удалось открыть публичную форму.'}</div> : null}
        {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || 'Не удалось загрузить точки.'}</div> : null}

        {presetLocation ? (
          <div className="card" style={{ display: 'grid', gap: 8 }}>
            <div className="muted small">QR / готовая ссылка</div>
            <div style={{ fontWeight: 700 }}>{locationLabel(presetLocation)}</div>
            <div className="muted small">{presetLocation.address || 'Адрес не указан'}</div>
            {presetLocked ? (
              <div className="muted small">Точка уже выбрана по QR-коду. Можно сразу описать запрос.</div>
            ) : (
              <div className="muted small">Точка подставлена из ссылки. При необходимости можно выбрать другую ниже.</div>
            )}
          </div>
        ) : null}

        {!presetLocked ? (
          <div className="card" style={{ display: 'grid', gap: 14 }}>
            <div>
              <div className="muted small" style={{ marginBottom: 6 }}>1. Выберите точку</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по городу, коду или названию"
                style={{ marginBottom: 12 }}
              />
              <div style={{ display: 'grid', gap: 10 }}>
                {(locationsQ.data || []).map((location) => {
                  const selected = location.id === locationId
                  return (
                    <button
                      key={location.id}
                      type="button"
                      className={selected ? '' : 'ghost'}
                      onClick={() => {
                        setLocationId(location.id)
                        nextFrameScroll(typeRef.current)
                      }}
                      style={{
                        textAlign: 'left',
                        padding: 14,
                        borderRadius: 16,
                        width: '100%',
                        border: selected ? '2px solid #0f766e' : '1px solid rgba(148,163,184,0.35)',
                        background: selected ? 'rgba(15,118,110,0.12)' : 'transparent',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{locationLabel(location)}</div>
                      <div className="muted small">
                        {[location.address, location.equipmentCount ? 'Оборудование: ' + location.equipmentCount : null].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  )
                })}
                {!locationsQ.isLoading && !(locationsQ.data || []).length ? <div className="muted">Подходящих точек не найдено.</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        <div ref={typeRef} className="card" style={{ display: 'grid', gap: 14 }}>
          <div>
            <div className="muted small" style={{ marginBottom: 8 }}>{presetLocked ? '1. Тип запроса' : '2. Тип запроса'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                className={requestType === 'repair' ? '' : 'ghost'}
                onClick={() => {
                  setRequestType('repair')
                  nextFrameScroll(detailsRef.current)
                }}
                style={{ minHeight: 68 }}
              >
                Нужен ремонт
              </button>
              <button
                type="button"
                className={requestType === 'note' ? '' : 'ghost'}
                onClick={() => {
                  setRequestType('note')
                  nextFrameScroll(detailsRef.current)
                }}
                style={{ minHeight: 68 }}
              >
                Замечание / note
              </button>
            </div>
          </div>

          {selectedLocation && (selectedLocation.equipmentCount || 0) > 0 && contextQ.data?.featureFlags.equipmentSelection ? (
            <div>
              <div className="muted small" style={{ marginBottom: 8 }}>{presetLocked ? '2. Оборудование' : '3. Оборудование'} (необязательно)</div>
              <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} disabled={equipmentQ.isLoading}>
                <option value="">Не знаю / пропустить</option>
                {(equipmentQ.data || []).map((item) => (
                  <option key={item.id} value={item.id}>{equipmentLabel(item)}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div ref={detailsRef}>
            <div className="muted small" style={{ marginBottom: 8 }}>{presetLocked ? '3. Что случилось?' : '4. Что случилось?'}</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={requestType === 'repair' ? 'Например: не греет, течёт, показывает ошибку, не запускается.' : 'Например: заметили шум, запах, трещину или риск, который нужно проверить.'}
            />
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <label>
              Телефон{requirePhone ? ' *' : ''}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+7 900 000-00-00" />
            </label>
            <label>
              Имя (необязательно)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться?" />
            </label>
          </div>

          {maxPhotos > 0 ? (
            <div>
              <div className="muted small" style={{ marginBottom: 8 }}>{presetLocked ? '4. Фото' : '5. Фото'} (необязательно)</div>
              <label style={{ display: 'grid', gap: 8 }}>
                <input type="file" accept="image/*" capture="environment" multiple onChange={onChoosePhotos} />
                <div className="muted small">До {maxPhotos} фото. Можно сразу сделать снимок с телефона.</div>
              </label>
              {previews.length ? (
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  {previews.map((preview, index) => (
                    <div key={preview.file.name + '-' + index} className="panel" style={{ padding: 10, display: 'grid', gap: 8 }}>
                      <img src={preview.url} alt={preview.file.name} style={{ width: '100%', borderRadius: 14, maxHeight: 220, objectFit: 'cover' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.file.name}</div>
                        <button type="button" className="ghost" onClick={() => removePhoto(index)}>Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="muted small" style={{ textAlign: 'center' }}>
          Форма работает без логина и создаёт обычную заявку внутри сервисного контура компании.
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 20,
          paddingTop: 12,
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,0.96) 28%)',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 10, padding: '0 16px' }}>
          <button type="button" onClick={validateAndSubmit} disabled={busy} style={{ width: '100%', minHeight: 54, fontSize: 16 }}>
            {submitM.isPending ? 'Отправляем заявку...' : 'Отправить заявку'}
          </button>
          <Link to="/request-access" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost" style={{ width: '100%' }}>Связаться с поддержкой</button>
          </Link>
        </div>
      </div>
    </div>
  )
}