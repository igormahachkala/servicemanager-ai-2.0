/**
 * Cursor Local Adapter — localStorage persistence for inbox/outbox (113C).
 */

import {
  CURSOR_LOCAL_ADAPTER_SYNC_EVENT,
  CURSOR_LOCAL_INBOX_STORAGE_KEY,
  CURSOR_LOCAL_OUTBOX_STORAGE_KEY,
  type CursorLocalResultEnvelope,
  type CursorLocalTaskEnvelope,
} from './cursorLocalAdapterTypes'

type InboxStore = {
  envelopes: Record<string, CursorLocalTaskEnvelope>
  updatedAt: string
}

type OutboxStore = {
  results: Record<string, CursorLocalResultEnvelope>
  updatedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CURSOR_LOCAL_ADAPTER_SYNC_EVENT))
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
  emitSync()
}

function readInboxStore(): InboxStore {
  return readJson<InboxStore>(CURSOR_LOCAL_INBOX_STORAGE_KEY, {
    envelopes: {},
    updatedAt: nowIso(),
  })
}

function readOutboxStore(): OutboxStore {
  return readJson<OutboxStore>(CURSOR_LOCAL_OUTBOX_STORAGE_KEY, {
    results: {},
    updatedAt: nowIso(),
  })
}

export function saveCursorLocalTaskEnvelope(envelope: CursorLocalTaskEnvelope): CursorLocalTaskEnvelope {
  const store = readInboxStore()
  store.envelopes[envelope.envelopeId] = envelope
  store.updatedAt = nowIso()
  writeJson(CURSOR_LOCAL_INBOX_STORAGE_KEY, store)
  return envelope
}

export function getCursorLocalTaskEnvelope(envelopeId: string): CursorLocalTaskEnvelope | null {
  return readInboxStore().envelopes[envelopeId] ?? null
}

export function listCursorLocalTaskEnvelopes(): CursorLocalTaskEnvelope[] {
  return Object.values(readInboxStore().envelopes).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export function saveCursorLocalResultEnvelope(result: CursorLocalResultEnvelope): CursorLocalResultEnvelope {
  const store = readOutboxStore()
  store.results[result.envelopeId] = result
  store.updatedAt = nowIso()
  writeJson(CURSOR_LOCAL_OUTBOX_STORAGE_KEY, store)
  return result
}

export function getCursorLocalResultEnvelope(envelopeId: string): CursorLocalResultEnvelope | null {
  return readOutboxStore().results[envelopeId] ?? null
}

export function listCursorLocalResultEnvelopes(): CursorLocalResultEnvelope[] {
  return Object.values(readOutboxStore().results).sort((a, b) =>
    b.ingestedAt.localeCompare(a.ingestedAt),
  )
}
