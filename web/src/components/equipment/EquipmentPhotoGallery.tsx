import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiRequestError } from '../../lib/api'
import {
  equipmentPhotosKey, getEquipmentPhotos, invalidateEquipmentPhotoQueries, isEquipmentPhotoUrl,
  selectEquipmentCover, selectedEquipmentPhoto,
} from '../../lib/equipmentPhotos'
import { ProtectedUploadImg } from '../../ui/ProtectedUploadMedia'

function GalleryImage({ url, alt, thumbnail = false }: { url: string; alt: string; thumbnail?: boolean }) {
  const [attempt, setAttempt] = useState(0)
  if (!isEquipmentPhotoUrl(url)) return <span role="status">Фото недоступно</span>
  return <ProtectedUploadImg
    key={`${url}:${attempt}`}
    url={url}
    alt={alt}
    loading={thumbnail ? 'lazy' : 'eager'}
    style={{ width: '100%', height: thumbnail ? 80 : 320, maxHeight: '60vh', objectFit: 'contain', borderRadius: 8 }}
    loadingFallback={<span role="status" aria-label="Загрузка фото" style={{ display: 'block', minHeight: thumbnail ? 80 : 200, background: 'var(--surface-2, #f3f4f6)', borderRadius: 8 }}>Загрузка фото…</span>}
    errorFallback={<span role="status">Не удалось показать фото.{!thumbnail ? <button type="button" className="ghost" onClick={() => setAttempt((value) => value + 1)}>Повторить загрузку фото</button> : null}</span>}
  />
}

type GalleryProps = {
  equipmentId: string
  scopeCompanyId?: string
  equipmentName: string
  canManage?: boolean
}

/** Remount state on asset/scope changes; an old mutation never affects the next gallery. */
export function EquipmentPhotoGallery(props: GalleryProps) {
  return <EquipmentPhotoGalleryContent key={`${props.equipmentId}:${props.scopeCompanyId || ''}`} {...props} />
}

/** Desktop can select a cover; mobile only reads this same authenticated gallery. */
function EquipmentPhotoGalleryContent({ equipmentId, scopeCompanyId, equipmentName, canManage = false }: GalleryProps) {
  const qc = useQueryClient()
  const key = equipmentPhotosKey(equipmentId, scopeCompanyId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [visibleCount, setVisibleCount] = useState(12)
  const saving = useRef(false)
  const photosQ = useQuery({
    queryKey: key,
    queryFn: () => getEquipmentPhotos(equipmentId, scopeCompanyId),
    retry: false,
  })
  const refresh = () => invalidateEquipmentPhotoQueries(qc, equipmentId)
  const coverM = useMutation({
    mutationFn: ({ photoId, version }: { photoId: string; version: string }) => selectEquipmentCover(equipmentId, photoId, version),
    onSuccess: async (confirmed, variables) => {
      // Never optimistically mark a cover: the server may report a newer choice.
      qc.setQueryData(key, confirmed)
      setNotice(confirmed.mainPhotoId === variables.photoId ? 'Обложка сохранена' : 'Обложка уже изменена в другой сессии. Показаны актуальные данные.')
      await refresh()
    },
    onError: async (error) => {
      setNotice(error instanceof ApiRequestError && error.status === 409
        ? 'Карточка или фотографии изменились. Обновите галерею, проверьте её и повторите выбор.'
        : 'Не удалось сохранить обложку. Проверьте доступ и повторите попытку.')
      await refresh()
    },
    onSettled: () => { saving.current = false },
  })

  const data = photosQ.data
  const selected = data ? selectedEquipmentPhoto(data, selectedId) : undefined
  return <section aria-label="Фотографии оборудования">
    <h3 style={{ marginBottom: 10 }}>Фотографии{data && !photosQ.isError ? ` (${data.photos.length})` : ''}</h3>
    {photosQ.isPending ? <div role="status" style={{ minHeight: 120 }}>Загружаем фотографии…</div>
      : photosQ.isError ? <div role="alert">Не удалось загрузить фотографии. <button type="button" className="ghost" onClick={() => void photosQ.refetch()}>Повторить</button></div>
      : !data?.photos.length ? <div role="status">Фотографии ещё не загружены</div>
      : <>
        {selected ? <div>
          <GalleryImage key={selected.id} url={selected.url} alt={`${equipmentName} — фото ${data.photos.indexOf(selected) + 1}`} />
          <div className="muted small" style={{ marginTop: 6 }}>{selected.id === data.mainPhotoId ? 'Обложка' : `Фото ${data.photos.indexOf(selected) + 1}`}</div>
        </div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginTop: 12 }}>
          {data.photos.slice(0, visibleCount).map((photo, index) => <button
            type="button" className="ghost" key={photo.id}
            aria-label={`Открыть фото ${index + 1}${photo.id === data.mainPhotoId ? ', обложка' : ''}`}
            aria-pressed={selected?.id === photo.id}
            onClick={() => setSelectedId(photo.id)}
            style={{ padding: 6, minWidth: 0, border: selected?.id === photo.id ? '2px solid currentColor' : undefined }}
          >
            <GalleryImage url={photo.url} alt="" thumbnail />
            <span>{photo.id === data.mainPhotoId ? 'Обложка' : `Фото ${index + 1}`}</span>
          </button>)}
        </div>
        {data.photos.length > visibleCount ? <button type="button" className="ghost" style={{ marginTop: 12 }} onClick={() => setVisibleCount((count) => count + 12)}>
          Показать ещё фотографии ({data.photos.length - visibleCount})
        </button> : null}
        {canManage && selected ? <button
          type="button" style={{ marginTop: 12 }}
          disabled={coverM.isPending || photosQ.isFetching || selected.id === data.mainPhotoId}
          onClick={() => {
            if (saving.current || photosQ.isFetching || selected.id === data.mainPhotoId) return
            saving.current = true
            setNotice('')
            coverM.mutate({ photoId: selected.id, version: data.version })
          }}
        >{coverM.isPending ? 'Сохраняем обложку…' : selected.id === data.mainPhotoId ? 'Текущая обложка' : 'Сделать обложкой'}</button> : null}
      </>}
    {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
  </section>
}
