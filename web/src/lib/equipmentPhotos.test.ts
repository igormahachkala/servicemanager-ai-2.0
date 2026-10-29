import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { getEquipmentPhotos, selectEquipmentCover, equipmentPhotosKey, invalidateEquipmentPhotoQueries } from './equipmentPhotos'
import { request } from './api'
vi.mock('./api', () => ({ request: vi.fn() }))

describe('Equipment photo API uses the existing authenticated request engine', () => {
  beforeEach(() => { vi.mocked(request).mockReset() })
  it('encodes the equipment and canonical read company scope', async () => {
    const data = { mainPhotoId: null, version: '2026-10-01T00:00:00.000Z', photos: [] }
    vi.mocked(request).mockResolvedValue(data)
    expect(await getEquipmentPhotos('eq/a', 'client/b')).toBe(data)
    expect(request).toHaveBeenCalledWith('/equipment/eq%2Fa/photos?companyId=client%2Fb')
  })
  it('sends only the chosen photo and observed server version; returns real server confirmation', async () => {
    const confirmed = { mainPhotoId: 'photo-2', version: '2026-10-02T00:00:00.000Z', photos: [] }
    vi.mocked(request).mockResolvedValue(confirmed)
    expect(await selectEquipmentCover('eq-1', 'photo-2', 'old-version')).toBe(confirmed)
    expect(request).toHaveBeenCalledWith('/equipment/eq-1/photos/cover', { method: 'PATCH', body: { photoId: 'photo-2', expectedVersion: 'old-version' } })
  })
  it('does not swallow a failed/stale selection as success', async () => {
    vi.mocked(request).mockRejectedValue(new Error('stale'))
    await expect(selectEquipmentCover('eq-1', 'photo-2', 'old-version')).rejects.toThrow('stale')
  })
})


describe('Equipment photo upload cache coherence', () => {
  it('invalidates a still-fresh inactive gallery so immediate return fetches the new photo', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: false, retry: false } } })
    const key = equipmentPhotosKey('eq-1', 'client-a')
    const before = { mainPhotoId: null, version: 'before', photos: [] }
    const after = { mainPhotoId: 'photo-1', version: 'after', photos: [{ id: 'photo-1' }] }
    client.setQueryData(key, before)
    client.setQueryData(['equipment-card', 'eq-1', 'client-a'], { id: 'eq-1', mainPhotoId: null })
    client.setQueryData(['mobile-equipment-card', 'eq-1', 'client-a'], { id: 'eq-1', mainPhotoId: null })
    client.setQueryData(equipmentPhotosKey('eq-2', 'client-a'), before)
    expect(client.getQueryState(key)?.isInvalidated).toBe(false)

    await invalidateEquipmentPhotoQueries(client, 'eq-1')
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    expect(client.getQueryState(['equipment-card', 'eq-1', 'client-a'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['mobile-equipment-card', 'eq-1', 'client-a'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(equipmentPhotosKey('eq-2', 'client-a'))?.isInvalidated).toBe(false)

    const queryFn = vi.fn().mockResolvedValue(after)
    const observer = new QueryObserver(client, { queryKey: key, queryFn })
    const refreshed = new Promise<void>((resolve) => {
      observer.subscribe((result) => { if (result.data?.version === 'after' && !result.isFetching) resolve() })
    })
    await refreshed
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(observer.getCurrentResult().data).toEqual(after)
    observer.destroy(); client.clear()
  })
  it('wires successful existing uploads to the original mutation equipment id, not the later selection', () => {
    const source = readFileSync(new URL('../views/EquipmentPage.tsx', import.meta.url), 'utf8')
    const photoMutation = source.slice(source.indexOf('const photoM ='), source.indexOf('const busy ='))
    expect(photoMutation).toContain('onSuccess: async (_photo, params)')
    expect(photoMutation).toContain('await invalidateEquipmentPhotoQueries(qc, params.id)')
    expect(photoMutation).not.toContain('invalidateEquipmentPhotoQueries(qc, selected')
  })
})
