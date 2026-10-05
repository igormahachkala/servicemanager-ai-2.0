import test from 'node:test'
import assert from 'node:assert/strict'

import { MemoryDriver, OFFLINE_IDB_SCHEMA_VERSION, STORE_NAMES } from './driver.js'
import {
  openOfflineSession,
  setOfflineDriverFactory,
  wipeOfflineSession,
} from './session.js'
import { readServerMediaBlob } from './serverMediaCache.js'
import { cacheRoundSnapshot, removeRoundSnapshot } from './roundCache.js'
import {
  isTicketCacheStale,
  loadTicketDetailCache,
  removeTicketDetailCache,
  saveTicketDetailCache,
  ticketDetailCacheState,
  TICKET_CACHE_STALE_MS,
} from './ticketDetailCache.js'
import { requestPersistentStorage } from './persistentStorage.js'
import { selectAutoPrefetchTicketIds } from './ticketPrefetch.js'

const IDENTITY = { companyId: 'co-cache', id: 'user-cache' }

async function openMemorySession() {
  const driver = new MemoryDriver()
  setOfflineDriverFactory(() => driver)
  const opened = await openOfflineSession(IDENTITY, { legacyStorage: null })
  assert.ok(opened.store)
  return { driver, store: opened.store }
}

async function closeMemorySession() {
  await wipeOfflineSession(IDENTITY)
  setOfflineDriverFactory(null)
}

const mediaDeps = {
  resolveUrl: (attachment: { url?: string | null; mimeType?: string | null }) => attachment.url || '',
  fetchBlob: async (url: string) => {
    const type = url.endsWith('.png') ? 'image/png' : 'image/webp'
    return new Blob([`original:${url}`], { type })
  },
}

test('fix-cache 1. schema v3 keeps server images outside outgoing blobs', async () => {
  assert.equal(OFFLINE_IDB_SCHEMA_VERSION, 3)
  assert.ok(STORE_NAMES.includes('serverMedia'))
  assert.ok(STORE_NAMES.includes('ticketDetailCache'))
  assert.ok(STORE_NAMES.includes('boardCache'))

  const { store } = await openMemorySession()
  const queued = await store!.enqueue({
    kind: 'ticket.attachment',
    target: { ticketId: 'ticket-1' },
    blob: new Blob(['outgoing'], { type: 'image/jpeg' }),
  })
  assert.equal(queued.ok, true)

  const saved = await saveTicketDetailCache({
    ticketId: 'ticket-1',
    ticket: { id: 'ticket-1' },
    attachments: [{ id: 'attachment-1', url: '/uploads/ticket-attachments/one.webp', mimeType: 'image/webp' }],
    timeline: null,
    mediaDeps,
  })
  assert.equal(saved.ok, true)
  assert.equal((await store!.listBlobIds()).length, 1)
  assert.equal((await store!.listServerMediaEntries()).length, 1)
  await closeMemorySession()
})

test('fix-cache 2. complete requires every original image and keeps bytes/type', async () => {
  await openMemorySession()
  const saved = await saveTicketDetailCache({
    ticketId: 'ticket-2',
    ticket: { id: 'ticket-2' },
    attachments: [
      { id: 'a-1', url: '/uploads/ticket-attachments/one.webp', mimeType: 'image/webp' },
      { id: 'a-2', url: '/uploads/ticket-attachments/two.png', mimeType: 'image/png' },
    ],
    timeline: { items: [] },
    mediaDeps,
  })
  assert.equal(saved.ok, true)
  assert.equal(await ticketDetailCacheState('ticket-2'), 'complete')
  const one = await readServerMediaBlob('/uploads/ticket-attachments/one.webp')
  const two = await readServerMediaBlob('/uploads/ticket-attachments/two.png')
  assert.equal(one?.type, 'image/webp')
  assert.equal(two?.type, 'image/png')
  assert.equal(await one?.text(), 'original:/uploads/ticket-attachments/one.webp')
  assert.equal(await two?.text(), 'original:/uploads/ticket-attachments/two.png')
  const entry = await loadTicketDetailCache('ticket-2')
  assert.ok(entry?.cachedAt)
  await closeMemorySession()
})

test('fix-cache 3. missing image leaves partial cache without cachedAt', async () => {
  await openMemorySession()
  const saved = await saveTicketDetailCache({
    ticketId: 'ticket-3',
    ticket: { id: 'ticket-3' },
    attachments: [{ id: 'a-missing', url: '/uploads/ticket-attachments/missing.webp', mimeType: 'image/webp' }],
    timeline: null,
    mediaDeps: { ...mediaDeps, fetchBlob: async () => null },
  })
  assert.equal(saved.ok, false)
  assert.equal(await ticketDetailCacheState('ticket-3'), 'partial')
  const entry = await loadTicketDetailCache('ticket-3')
  assert.equal(entry?.cachedAt, undefined)
  await closeMemorySession()
})

test('fix-cache 4. cache becomes stale after eight hours', () => {
  const now = Date.parse('2026-10-05T12:00:00.000Z')
  assert.equal(isTicketCacheStale(new Date(now - TICKET_CACHE_STALE_MS + 1).toISOString(), now), false)
  assert.equal(isTicketCacheStale(new Date(now - TICKET_CACHE_STALE_MS).toISOString(), now), true)
  assert.equal(TICKET_CACHE_STALE_MS, 8 * 60 * 60 * 1000)
})

test('fix-cache 5. deleting parent removes unshared server originals', async () => {
  await openMemorySession()
  const url = '/uploads/ticket-attachments/delete.webp'
  await saveTicketDetailCache({
    ticketId: 'ticket-delete',
    ticket: { id: 'ticket-delete' },
    attachments: [{ id: 'a-delete', url, mimeType: 'image/webp' }],
    timeline: null,
    mediaDeps,
  })
  assert.ok(await readServerMediaBlob(url))
  await removeTicketDetailCache('ticket-delete')
  assert.equal(await readServerMediaBlob(url), null)
  await closeMemorySession()
})

test('fix-cache 6. shared original stays if another parent still uses it', async () => {
  await openMemorySession()
  const url = '/uploads/ticket-attachments/shared.webp'
  await saveTicketDetailCache({
    ticketId: 'ticket-a',
    ticket: { id: 'ticket-a' },
    attachments: [{ id: 'a-shared', url, mimeType: 'image/webp' }],
    timeline: null,
    mediaDeps,
  })
  await saveTicketDetailCache({
    ticketId: 'ticket-b',
    ticket: { id: 'ticket-b' },
    attachments: [{ id: 'b-shared', url, mimeType: 'image/webp' }],
    timeline: null,
    mediaDeps,
  })
  await removeTicketDetailCache('ticket-a')
  assert.ok(await readServerMediaBlob(url))
  await removeTicketDetailCache('ticket-b')
  assert.equal(await readServerMediaBlob(url), null)
  await closeMemorySession()
})

test('fix-cache 7. quota failure does not mark ticket complete', async () => {
  const { driver } = await openMemorySession()
  driver.failNextWrite = {
    ok: false,
    reason: 'quota',
    message: 'Недостаточно места на устройстве',
  }
  const saved = await saveTicketDetailCache({
    ticketId: 'ticket-quota',
    ticket: { id: 'ticket-quota' },
    attachments: [],
    timeline: null,
    mediaDeps,
  })
  assert.equal(saved.ok, false)
  if (!saved.ok) assert.equal(saved.storageUnavailable, true)
  assert.equal(await ticketDetailCacheState('ticket-quota'), 'none')
  await closeMemorySession()
})

test('fix-cache 8. entity snapshot without detail is not cached-complete', async () => {
  const { store } = await openMemorySession()
  await store!.cacheTicket({ id: 'ticket-entity-only', status: 'IN_PROGRESS' })
  assert.equal(await ticketDetailCacheState('ticket-entity-only'), 'none')
  await closeMemorySession()
})

test('fix-cache 9. round and checkpoint originals are cached and removed with parent', async () => {
  await openMemorySession()
  const url = '/uploads/inspection-run-items/cp.webp'
  await cacheRoundSnapshot({
    id: 'round-1',
    items: [{
      id: 'cp-1',
      attachments: [{ id: 'att-1', url, mimeType: 'image/webp', originalName: 'cp.webp' }],
    }],
  }, mediaDeps)
  assert.ok(await readServerMediaBlob(url))
  await removeRoundSnapshot('round-1')
  assert.equal(await readServerMediaBlob(url), null)
  await closeMemorySession()
})

test('fix-cache 10. auto prefetch takes all in-progress and first five assigned', () => {
  const me = 'tech-1'
  const all = [
    { id: 'ip-hidden', status: 'IN_PROGRESS', assignedTechnicianId: me },
    { id: 'as-6', status: 'ASSIGNED', assignedTechnicianId: me },
    { id: 'other', status: 'IN_PROGRESS', assignedTechnicianId: 'other' },
  ]
  const home = [
    { id: 'as-1', status: 'ASSIGNED', assignedTechnicianId: me },
    { id: 'as-2', status: 'ASSIGNED', assignedTechnicianId: me },
    { id: 'as-3', status: 'ASSIGNED', assignedTechnicianId: me },
    { id: 'as-4', status: 'ASSIGNED', assignedTechnicianId: me },
    { id: 'as-5', status: 'ASSIGNED', assignedTechnicianId: me },
    { id: 'as-6', status: 'ASSIGNED', assignedTechnicianId: me },
    { id: 'ip-listed', status: 'IN_PROGRESS', assignedTechnicianId: me },
  ]
  assert.deepEqual(selectAutoPrefetchTicketIds(all, home, me), [
    'ip-hidden',
    'as-1',
    'as-2',
    'as-3',
    'as-4',
    'as-5',
  ])
})

test('fix-cache 11. persistent storage is requested through feature detection', async () => {
  let requests = 0
  assert.equal(await requestPersistentStorage(null), 'unsupported')
  assert.equal(await requestPersistentStorage({
    persisted: async () => false,
    persist: async () => {
      requests += 1
      return true
    },
  }), 'granted')
  assert.equal(requests, 1)
})

test('fix-cache 12. Home wires auto/manual cache and media reads IDB before network', async () => {
  const { readFileSync } = await import('node:fs')
  const home = readFileSync(new URL('../../../src/mobile/home/MobileHome.tsx', import.meta.url), 'utf8')
  const hook = readFileSync(new URL('../../../src/mobile/home/useTicketOfflineCache.ts', import.meta.url), 'utf8')
  const prefetch = readFileSync(new URL('../../../src/mobile/offline/ticketPrefetch.ts', import.meta.url), 'utf8')
  const protectedSrc = readFileSync(new URL('../../../src/ui/useProtectedUploadSrc.ts', import.meta.url), 'utf8')
  const runtime = readFileSync(new URL('../../../src/mobile/offline/runtime.ts', import.meta.url), 'utf8')
  const sw = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8')
  const detail = readFileSync(new URL('../../../src/mobile/offline/ticketDetailCache.ts', import.meta.url), 'utf8')
  const media = readFileSync(new URL('../../../src/mobile/offline/serverMediaCache.ts', import.meta.url), 'utf8')
  const driver = readFileSync(new URL('../../../src/mobile/offline/driver.ts', import.meta.url), 'utf8')

  assert.match(home, /HomeOfflineCachePanel/)
  assert.match(home, /useTicketOfflineCache/)
  assert.match(home, /homeListTickets/)
  assert.match(hook, /selectAutoPrefetchTicketIds/)
  assert.match(prefetch, /status === 'IN_PROGRESS'/)
  assert.match(prefetch, /status === 'ASSIGNED'/)
  assert.match(prefetch, /\.slice\(0, 5\)/)
  assert.match(protectedSrc, /readServerMediaBlob/)
  assert.match(runtime, /requestPersistentStorage\(\)/)
  assert.doesNotMatch(sw, /serverMedia|ticketDetailCache/)
  assert.doesNotMatch(detail, /localStorage\.setItem|safeSetItem|caches\.(open|put|match)/)
  assert.doesNotMatch(media, /localStorage\.setItem|safeSetItem|caches\.(open|put|match)/)
  assert.doesNotMatch(driver, /LRU|maxBytes|evict/i)
  assert.doesNotMatch(media, /LRU|maxBytes|evict/i)
})
