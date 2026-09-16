import { afterEach, describe, expect, it } from 'vitest'
import {
  BROWSER_STORAGE_ERROR_MESSAGE,
  BrowserStorageError,
  applyStorageSchemaVersion,
  classifyBrowserStorageError,
  requireSetItem,
  restoreStorageSnapshot,
  safeGetItem,
  safeSetItem,
  snapshotStorageItems,
} from './browserStorage'

class FakeStorage {
  map: Map<string, string>
  setError: DOMException | null
  getError: DOMException | null
  removeError: DOMException | null

  constructor(options: {
    initial?: Record<string, string>
    setError?: DOMException | null
    getError?: DOMException | null
    removeError?: DOMException | null
  } = {}) {
    this.map = new Map(Object.entries(options.initial || {}))
    this.setError = options.setError || null
    this.getError = options.getError || null
    this.removeError = options.removeError || null
  }

  get length() {
    return this.map.size
  }

  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }

  getItem(key: string) {
    if (this.getError) throw this.getError
    return this.map.has(key) ? this.map.get(key)! : null
  }

  setItem(key: string, value: string) {
    if (this.setError) throw this.setError
    this.map.set(key, String(value))
  }

  removeItem(key: string) {
    if (this.removeError) throw this.removeError
    this.map.delete(key)
  }
}

function setWindow(windowValue: object | undefined) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: windowValue,
  })
}

afterEach(() => {
  setWindow(undefined)
})

describe('browserStorage', () => {
  it('writes and reads through localStorage', () => {
    const local = new FakeStorage()
    setWindow({ localStorage: local, sessionStorage: new FakeStorage() })
    expect(safeSetItem('local', 'sm_token', 'token').ok).toBe(true)
    expect(safeGetItem('local', 'sm_token', '')).toBe('token')
  })

  it('classifies quota errors without leaking the browser text', () => {
    const local = new FakeStorage({
      setError: new DOMException('The quota has been exceeded.', 'QuotaExceededError'),
    })
    setWindow({ localStorage: local, sessionStorage: new FakeStorage() })
    const result = safeSetItem('local', 'sm_token', 'token')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.kind).toBe('quota')
    expect(result.error.message).toBe(BROWSER_STORAGE_ERROR_MESSAGE)
    expect(result.error.message).not.toMatch(/QuotaExceededError|quota has been exceeded/i)
    expect(() => requireSetItem('local', 'sm_token', 'token')).toThrow(BrowserStorageError)
  })

  it('classifies a blocked localStorage accessor as security', () => {
    const failingWindow = {}
    Object.defineProperty(failingWindow, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    Object.defineProperty(failingWindow, 'sessionStorage', {
      value: new FakeStorage(),
    })
    setWindow(failingWindow)
    const result = safeSetItem('local', 'sm_token', 'token')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.kind).toBe('security')
    expect(safeGetItem('local', 'sm_token', 'fallback')).toBe('fallback')
  })

  it('treats missing storage as unavailable', () => {
    setWindow({})
    const result = safeSetItem('local', 'sm_token', 'token')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.error.kind).toBe('unavailable')
    expect(safeGetItem('local', 'sm_token', 'fallback')).toBe('fallback')
  })

  it('classifies DOMException names', () => {
    expect(classifyBrowserStorageError(new DOMException('nope', 'NotSupportedError'))).toBe('not-supported')
    expect(classifyBrowserStorageError(new DOMException('blocked', 'SecurityError'))).toBe('security')
  })

  it('restores a snapshot', () => {
    const local = new FakeStorage({ initial: { sm_token: 'old', sm_user_role: 'TECHNICIAN' } })
    setWindow({ localStorage: local, sessionStorage: new FakeStorage() })
    const snapshot = snapshotStorageItems('local', ['sm_token', 'sm_user_role', 'missing'])
    requireSetItem('local', 'sm_token', 'new')
    restoreStorageSnapshot('local', snapshot)
    expect(local.getItem('sm_token')).toBe('old')
    expect(local.getItem('sm_user_role')).toBe('TECHNICIAN')
    expect(local.getItem('missing')).toBe(null)
  })

  it('drops obsolete keys when the schema version changes', () => {
    const local = new FakeStorage({
      initial: {
        obsolete: '1',
        'sma.mobileGuidedTour.v1.user': 'completed',
        keep: '1',
      },
    })
    setWindow({ localStorage: local, sessionStorage: new FakeStorage() })
    const result = applyStorageSchemaVersion({
      versionKey: 'sma_storage_schema_version',
      currentVersion: '2',
      obsoleteLocalStorageKeys: ['obsolete'],
      obsoleteLocalStoragePrefixes: ['sma.mobileGuidedTour.v1.'],
    })
    expect(result.ok).toBe(true)
    expect(local.getItem('obsolete')).toBe(null)
    expect(local.getItem('sma.mobileGuidedTour.v1.user')).toBe(null)
    expect(local.getItem('keep')).toBe('1')
    expect(local.getItem('sma_storage_schema_version')).toBe('2')
  })
})
