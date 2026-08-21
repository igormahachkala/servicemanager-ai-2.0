export const BROWSER_STORAGE_ERROR_MESSAGE =
  'Не удалось сохранить данные входа в браузере. Очистите данные сайта или освободите хранилище и повторите вход.'

export type BrowserStorageArea = 'local' | 'session'
export type BrowserStorageOperation = 'get' | 'set' | 'remove' | 'clearNamespace' | 'snapshot' | 'version'
export type BrowserStorageErrorKind = 'quota' | 'security' | 'not-supported' | 'unavailable' | 'unknown'

export type BrowserStorageSnapshotEntry = {
  key: string
  value: string | null
}

export type SafeStorageResult = {
  ok: true
} | {
  ok: false
  error: BrowserStorageError
}

export class BrowserStorageError extends Error {
  readonly area: BrowserStorageArea
  readonly operation: BrowserStorageOperation
  readonly key: string | null
  readonly kind: BrowserStorageErrorKind
  readonly causeName: string | null

  constructor(params: {
    area: BrowserStorageArea
    operation: BrowserStorageOperation
    key?: string | null
    cause?: unknown
  }) {
    super(BROWSER_STORAGE_ERROR_MESSAGE)
    this.name = 'BrowserStorageError'
    this.area = params.area
    this.operation = params.operation
    this.key = params.key ?? null
    this.kind = classifyBrowserStorageError(params.cause)
    this.causeName = browserStorageCauseName(params.cause)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export function classifyBrowserStorageError(err: unknown): BrowserStorageErrorKind {
  const name = browserStorageCauseName(err)
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota'
  if (name === 'SecurityError') return 'security'
  if (name === 'NotSupportedError') return 'not-supported'
  if (name === 'StorageUnavailable') return 'unavailable'

  const message = typeof (err as { message?: unknown })?.message === 'string'
    ? ((err as { message: string }).message || '').toLowerCase()
    : ''
  if (message.includes('quota')) return 'quota'
  if (message.includes('security') || message.includes('denied')) return 'security'
  if (message.includes('not supported')) return 'not-supported'
  if (message.includes('unavailable') || message.includes('disabled')) return 'unavailable'
  return 'unknown'
}

function browserStorageCauseName(err: unknown): string | null {
  const name = typeof (err as { name?: unknown })?.name === 'string'
    ? ((err as { name: string }).name || '').trim()
    : ''
  return name || null
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined'
}

function storageUnavailable(area: BrowserStorageArea, operation: BrowserStorageOperation, key?: string | null) {
  return new BrowserStorageError({
    area,
    operation,
    key,
    cause: { name: 'StorageUnavailable', message: `${area}Storage unavailable` },
  })
}

function getStorage(area: BrowserStorageArea, operation: BrowserStorageOperation, key?: string | null): Storage | BrowserStorageError | null {
  if (!isBrowserRuntime()) return null
  try {
    const storage = area === 'local' ? window.localStorage : window.sessionStorage
    return storage || storageUnavailable(area, operation, key)
  } catch (err) {
    return new BrowserStorageError({ area, operation, key, cause: err })
  }
}

function ok(): SafeStorageResult {
  return { ok: true }
}

function fail(error: BrowserStorageError): SafeStorageResult {
  return { ok: false, error }
}

export function safeGetItem(area: BrowserStorageArea, key: string, fallback: string | null = null): string | null {
  const storage = getStorage(area, 'get', key)
  if (!storage || storage instanceof BrowserStorageError) return fallback
  try {
    return storage.getItem(key)
  } catch {
    return fallback
  }
}

export function safeSetItem(area: BrowserStorageArea, key: string, value: string): SafeStorageResult {
  const storage = getStorage(area, 'set', key)
  if (!storage) return ok()
  if (storage instanceof BrowserStorageError) return fail(storage)
  try {
    storage.setItem(key, value)
    return ok()
  } catch (err) {
    return fail(new BrowserStorageError({ area, operation: 'set', key, cause: err }))
  }
}

export function requireSetItem(area: BrowserStorageArea, key: string, value: string): void {
  const result = safeSetItem(area, key, value)
  if (!result.ok) throw result.error
}

export function safeRemoveItem(area: BrowserStorageArea, key: string): SafeStorageResult {
  const storage = getStorage(area, 'remove', key)
  if (!storage) return ok()
  if (storage instanceof BrowserStorageError) return fail(storage)
  try {
    storage.removeItem(key)
    return ok()
  } catch (err) {
    return fail(new BrowserStorageError({ area, operation: 'remove', key, cause: err }))
  }
}

export function safeClearNamespace(
  area: BrowserStorageArea,
  params: {
    keys?: readonly string[]
    prefixes?: readonly string[]
  },
): SafeStorageResult {
  const storage = getStorage(area, 'clearNamespace')
  if (!storage) return ok()
  if (storage instanceof BrowserStorageError) return fail(storage)

  try {
    const keys = new Set((params.keys || []).filter(Boolean))
    const prefixes = (params.prefixes || []).filter(Boolean)
    if (prefixes.length) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
          keys.add(key)
        }
      }
    }
    for (const key of keys) {
      storage.removeItem(key)
    }
    return ok()
  } catch (err) {
    return fail(new BrowserStorageError({ area, operation: 'clearNamespace', cause: err }))
  }
}

export function snapshotStorageItems(area: BrowserStorageArea, keys: readonly string[]): BrowserStorageSnapshotEntry[] {
  const storage = getStorage(area, 'snapshot')
  if (!storage) return []
  if (storage instanceof BrowserStorageError) throw storage
  try {
    return keys.map((key) => ({ key, value: storage.getItem(key) }))
  } catch (err) {
    throw new BrowserStorageError({ area, operation: 'snapshot', cause: err })
  }
}

export function restoreStorageSnapshot(area: BrowserStorageArea, snapshot: readonly BrowserStorageSnapshotEntry[]): void {
  const storage = getStorage(area, 'snapshot')
  if (!storage || storage instanceof BrowserStorageError) return
  for (const entry of snapshot) {
    try {
      if (entry.value === null) {
        storage.removeItem(entry.key)
      } else {
        storage.setItem(entry.key, entry.value)
      }
    } catch {
      // Best-effort rollback. The caller keeps the classified persistence error.
    }
  }
}

export function safeReadJson<T>(area: BrowserStorageArea, key: string, fallback: T): T {
  const raw = safeGetItem(area, key, null)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function safeWriteJson(area: BrowserStorageArea, key: string, value: unknown): SafeStorageResult {
  return safeSetItem(area, key, JSON.stringify(value))
}

export function applyStorageSchemaVersion(params: {
  versionKey: string
  currentVersion: string
  obsoleteLocalStorageKeys?: readonly string[]
  obsoleteLocalStoragePrefixes?: readonly string[]
  obsoleteSessionStorageKeys?: readonly string[]
  obsoleteSessionStoragePrefixes?: readonly string[]
}): SafeStorageResult {
  const current = safeGetItem('local', params.versionKey, null)
  if (current === params.currentVersion) return ok()

  const localResult = safeClearNamespace('local', {
    keys: params.obsoleteLocalStorageKeys,
    prefixes: params.obsoleteLocalStoragePrefixes,
  })
  const sessionResult = safeClearNamespace('session', {
    keys: params.obsoleteSessionStorageKeys,
    prefixes: params.obsoleteSessionStoragePrefixes,
  })
  const versionResult = safeSetItem('local', params.versionKey, params.currentVersion)

  if (!localResult.ok) return localResult
  if (!sessionResult.ok) return sessionResult
  return versionResult
}
