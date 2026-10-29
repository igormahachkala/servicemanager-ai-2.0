import type { QueryClient } from '@tanstack/react-query'
import { request } from './api'

export type EquipmentPhoto = {
  id: string
  url: string
  mimeType: string
  createdAt: string
}

export type EquipmentPhotoGalleryData = {
  mainPhotoId: string | null
  version: string
  photos: EquipmentPhoto[]
}

export const equipmentPhotosKey = (id: string, companyId = '') => ['equipment-photos', id, companyId] as const

export function getEquipmentPhotos(id: string, companyId?: string): Promise<EquipmentPhotoGalleryData> {
  const scope = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
  return request(`/equipment/${encodeURIComponent(id)}/photos${scope}`)
}

export function selectEquipmentCover(id: string, photoId: string, expectedVersion: string): Promise<EquipmentPhotoGalleryData> {
  return request(`/equipment/${encodeURIComponent(id)}/photos/cover`, {
    method: 'PATCH', body: { photoId, expectedVersion },
  })
}

// Defence in depth: the shared media hook supports external URLs for other uses,
// but equipment photos must never use its public-URL passthrough.
export function isEquipmentPhotoUrl(url: string): boolean {
  return /^\/uploads\/equipment\/[0-9a-f-]+\.[a-zA-Z0-9]{1,10}$/.test(url)
}

export function selectedEquipmentPhoto(data: EquipmentPhotoGalleryData, selectedId: string | null) {
  return data.photos.find((photo) => photo.id === selectedId)
    ?? data.photos.find((photo) => photo.id === data.mainPhotoId)
    ?? data.photos[0]
}

/** Shared by upload and cover selection: inactive fresh caches must refetch on return. */
export async function invalidateEquipmentPhotoQueries(client: Pick<QueryClient, 'invalidateQueries'>, equipmentId: string) {
  await Promise.all([
    ...['equipment-photos', 'equipment-card', 'mobile-equipment-card'].map((prefix) => client.invalidateQueries({ queryKey: [prefix, equipmentId] })),
    ...['equipment-list', 'mobile-equipment', 'equipment-by-location', 'location-card-equipment', 'location-equipment', 'mobile-create-equipment'].map((prefix) => client.invalidateQueries({ queryKey: [prefix] })),
  ])
}
