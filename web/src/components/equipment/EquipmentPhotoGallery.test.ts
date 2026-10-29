import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { EquipmentPhotoGallery } from './EquipmentPhotoGallery'
import { equipmentPhotosKey, selectedEquipmentPhoto, isEquipmentPhotoUrl } from '../../lib/equipmentPhotos'
import type { EquipmentPhotoGalleryData } from '../../lib/equipmentPhotos'

const DATA: EquipmentPhotoGalleryData = {
  mainPhotoId: 'photo-1', version: '2026-10-01T00:00:00.000Z', photos: [
    { id: 'photo-1', url: '/uploads/equipment/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', mimeType: 'image/jpeg', createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 'photo-2', url: '/uploads/equipment/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png', mimeType: 'image/png', createdAt: '2026-10-01T00:00:00.000Z' },
  ],
}
function render(data?: EquipmentPhotoGalleryData, canManage = false, error = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const key = equipmentPhotosKey('eq-1', 'client-1')
  if (data) client.setQueryData(key, data)
  if (error) client.getQueryCache().build(client, { queryKey: key }).setState({ error: new Error('Network failed'), status: 'error', fetchStatus: 'idle' })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(EquipmentPhotoGallery, {
    equipmentId: 'eq-1', scopeCompanyId: 'client-1', equipmentName: 'Котёл', canManage,
  })))
}

describe('Equipment gallery SSR presentation', () => {
  it('renders all photographs and the confirmed cover', () => {
    const html = render(DATA, true)
    expect(html).toContain('Фотографии (2)')
    expect(html).toContain('Открыть фото 1, обложка')
    expect(html).toContain('Открыть фото 2')
    expect(html).toContain('Текущая обложка')
    expect(html).toContain('disabled=""')
  })
  it('read-only/mobile defaults never render a cover mutation', () => {
    const html = render(DATA)
    expect(html).toContain('Открыть фото 2')
    expect(html).not.toMatch(/Сделать обложкой|Текущая обложка|Сохраняем обложку/)
  })
  it('initial loading is not mistaken for an empty gallery', () => {
    const html = render()
    expect(html).toContain('Загружаем фотографии…')
    expect(html).not.toContain('Фотографии ещё не загружены')
  })
  it('failure offers retry, hides stale metadata and never becomes an empty success', () => {
    const html = render(DATA, true, true)
    expect(html).toContain('Не удалось загрузить фотографии')
    expect(html).toContain('Повторить')
    expect(html).not.toMatch(/Фотографии ещё не загружены|Открыть фото|Фотографии \(2\)|Текущая обложка/)
  })
  it('successful empty is explicit', () => {
    const html = render({ ...DATA, photos: [], mainPhotoId: null })
    expect(html).toContain('Фотографии ещё не загружены')
    expect(html).not.toContain('Не удалось загрузить')
  })
  it('renders loading skeletons, never unprotected binary URLs or an unauthenticated anchor', () => {
    const html = render(DATA)
    expect(html).toContain('Загрузка фото')
    expect(html).not.toMatch(/<img|<a |\/uploads\/equipment|https:/)
  })
  it('rejects an external image before the shared media passthrough can expose it', () => {
    const html = render({ ...DATA, photos: [{ ...DATA.photos[0], url: 'https://external.example/private.jpg' }] })
    expect(html).toContain('Фото недоступно')
    expect(html).not.toContain('external.example')
    expect(html).not.toContain('<img')
  })
  it('does not silently cap a larger existing gallery', () => {
    const photos = Array.from({ length: 125 }, (_, i) => ({ ...DATA.photos[0], id: `photo-${i + 1}` }))
    const html = render({ ...DATA, photos })
    expect(html).toContain('Фотографии (125)')
    expect(html).toContain('Открыть фото 12')
    expect(html).not.toContain('Открыть фото 13')
    expect(html).toContain('Показать ещё фотографии (113)')
  })
})

describe('Equipment gallery selection and safe route helpers', () => {
  it('defaults to the confirmed cover, then permits viewing another without changing the cover', () => {
    expect(selectedEquipmentPhoto(DATA, null)?.id).toBe('photo-1')
    expect(selectedEquipmentPhoto(DATA, 'photo-2')?.id).toBe('photo-2')
    expect(DATA.mainPhotoId).toBe('photo-1')
  })
  it('preserves the viewed image after a stale-cover refresh and falls back if it was deleted', () => {
    const changed = { ...DATA, mainPhotoId: 'photo-2' }
    expect(selectedEquipmentPhoto(changed, 'photo-1')?.id).toBe('photo-1')
    expect(selectedEquipmentPhoto({ ...changed, photos: [DATA.photos[1]] }, 'photo-1')?.id).toBe('photo-2')
    expect(selectedEquipmentPhoto({ ...DATA, mainPhotoId: 'deleted' }, null)?.id).toBe('photo-1')
    expect(selectedEquipmentPhoto({ ...DATA, photos: [] }, null)).toBeUndefined()
  })
  it('keeps equipment/company query scopes separate', () => {
    expect(equipmentPhotosKey('eq-1', 'client-a')).not.toEqual(equipmentPhotosKey('eq-1', 'client-b'))
    expect(equipmentPhotosKey('eq-1')).toEqual(['equipment-photos', 'eq-1', ''])
  })
  it('accepts only protected equipment photo paths', () => {
    expect(isEquipmentPhotoUrl(DATA.photos[0].url)).toBe(true)
    for (const url of ['https://example.com/a.jpg', '//example.com/a.jpg', 'data:image/svg+xml,x', '/uploads/ticket-attachments/a.jpg', '/uploads/equipment/../x.jpg', '/uploads/equipment/a.jpg?token=secret']) {
      expect(isEquipmentPhotoUrl(url)).toBe(false)
    }
  })
})
