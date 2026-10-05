import type { WriteResult } from './driver.js'
import { offlineStore, reportOfflineStorageUnavailable } from './runtime.js'

export type ServerMediaParentType = 'ticket' | 'round' | 'checkpoint' | 'location' | 'other'

export type ServerMediaParent = {
  type: ServerMediaParentType
  id: string
}

export type ServerImageCandidate = {
  attachmentId?: string
  url: string
  mimeType?: string | null
  fileName?: string | null
}

export type ServerMediaEntry = {
  key: string
  url: string
  attachmentId?: string
  parents: ServerMediaParent[]
  blob: Blob
  cachedAt: string
}

export type CacheServerImagesResult =
  | { ok: true; urls: string[] }
  | { ok: false; message: string; storageUnavailable: boolean; urls: string[] }

function normalizedUrl(url: string): string {
  return url.trim()
}

function sameParent(left: ServerMediaParent, right: ServerMediaParent): boolean {
  return left.type === right.type && left.id === right.id
}

function mediaKey(url: string): string {
  return `server:${normalizedUrl(url)}`
}

export function isServerImageCandidate(candidate: ServerImageCandidate): boolean {
  const mime = (candidate.mimeType || '').trim().toLowerCase()
  if (mime) return mime.startsWith('image/')
  const name = `${candidate.fileName || ''} ${candidate.url}`.toLowerCase()
  return /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:[?#\s]|$)/.test(name)
}

export async function readServerMediaBlob(url: string): Promise<Blob | null> {
  const store = offlineStore()
  const key = mediaKey(url)
  if (!store || key === 'server:') return null
  const entry = await store.readServerMediaEntry<ServerMediaEntry>(key)
  return entry?.blob ?? null
}

async function putServerMedia(
  candidate: ServerImageCandidate,
  parent: ServerMediaParent,
  blob: Blob,
): Promise<WriteResult> {
  const store = offlineStore()
  if (!store?.available) {
    return { ok: false, reason: 'unavailable', message: 'Офлайн-хранилище недоступно' }
  }

  const url = normalizedUrl(candidate.url)
  const key = mediaKey(url)
  const current = await store.readServerMediaEntry<ServerMediaEntry>(key)
  const parents = current?.parents?.some((item) => sameParent(item, parent))
    ? current.parents
    : [...(current?.parents || []), parent]

  return store.cacheServerMediaEntry(key, {
    key,
    url,
    attachmentId: candidate.attachmentId || current?.attachmentId,
    parents,
    blob,
    cachedAt: new Date().toISOString(),
  } satisfies ServerMediaEntry)
}

export async function cacheServerImagesForParent(params: {
  parent: ServerMediaParent
  candidates: ServerImageCandidate[]
  fetchBlob: (url: string) => Promise<Blob | null>
}): Promise<CacheServerImagesResult> {
  const images = params.candidates.filter(isServerImageCandidate)
  const urls: string[] = []

  for (const candidate of images) {
    const url = normalizedUrl(candidate.url)
    if (!url) continue
    urls.push(url)

    const cached = await readServerMediaBlob(url)
    const blob = cached || (await params.fetchBlob(url))
    if (!blob) {
      return {
        ok: false,
        message: `Не удалось скачать изображение ${candidate.fileName || candidate.attachmentId || url}`,
        storageUnavailable: false,
        urls,
      }
    }

    const write = await putServerMedia({ ...candidate, url }, params.parent, blob)
    if (!write.ok) {
      if (write.reason === 'quota' || write.reason === 'unavailable') {
        reportOfflineStorageUnavailable(write.message)
      }
      return {
        ok: false,
        message: write.message,
        storageUnavailable: write.reason === 'quota' || write.reason === 'unavailable',
        urls,
      }
    }
  }

  return { ok: true, urls }
}

export async function hasAllServerMedia(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    if (!(await readServerMediaBlob(url))) return false
  }
  return true
}

/** Убирает связь с родителем; Blob удаляется, когда других родителей нет. */
export async function deleteServerMediaForParent(parent: ServerMediaParent): Promise<void> {
  const store = offlineStore()
  if (!store) return

  const entries = await store.listServerMediaEntries<ServerMediaEntry>()
  for (const entry of entries) {
    const parents = (entry.parents || []).filter((item) => !sameParent(item, parent))
    if (parents.length === entry.parents.length) continue
    if (parents.length === 0) {
      await store.deleteServerMediaEntry(entry.key)
    } else {
      await store.cacheServerMediaEntry(entry.key, { ...entry, parents })
    }
  }
}

/** После обновления parent удаляет только устаревшие связи, не чужие Blob. */
export async function retainServerMediaForParent(
  parent: ServerMediaParent,
  retainedUrls: string[],
): Promise<void> {
  const store = offlineStore()
  if (!store) return
  const retained = new Set(retainedUrls.map(normalizedUrl))
  const entries = await store.listServerMediaEntries<ServerMediaEntry>()

  for (const entry of entries) {
    if (retained.has(entry.url) || !(entry.parents || []).some((item) => sameParent(item, parent))) continue
    const parents = entry.parents.filter((item) => !sameParent(item, parent))
    if (parents.length === 0) await store.deleteServerMediaEntry(entry.key)
    else await store.cacheServerMediaEntry(entry.key, { ...entry, parents })
  }
}
