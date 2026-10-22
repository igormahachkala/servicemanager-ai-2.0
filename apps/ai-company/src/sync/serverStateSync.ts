/**
 * Server state sync — the company's localStorage, shared through the server.
 *
 * Every store in the app persists to localStorage under `ai-company-*` and
 * reads it back on each call (no module caches), so syncing the storage itself
 * makes every browser see the same company without touching ~70 stores:
 *
 *   boot:   GET /runtime/state/v1/snapshot -> write keys locally BEFORE the app
 *           imports anything (main.tsx awaits this). Empty server + local data
 *           = first device: its data is uploaded instead.
 *   write:  localStorage.setItem/removeItem on a shared key -> queued -> PUT
 *   pull:   GET /v1/changes?since=rev every few seconds -> apply + 'storage'
 *           event, which the stores' hooks already listen to.
 *
 * Conflicts: last write wins per key (V1). A key with a local write still in
 * flight ignores remote values until the write lands.
 * If the server is unreachable the app runs on local storage as before.
 */

export const SHARED_KEY_PREFIX = 'ai-company-'

/** Per-device preferences: never shared. */
export const DEVICE_LOCAL_KEYS: ReadonlySet<string> = new Set([
  'ai-company-language',
  'ai-company-theme-preference',
  'ai-company-first-five-minutes-collapsed',
  'ai-company-mobile-first-launch-completed',
  'ai-company-active-company',
  'ai-company-active-workspace',
])

export function isSharedKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.startsWith(SHARED_KEY_PREFIX) && !DEVICE_LOCAL_KEYS.has(key)
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type ServerStateSyncOptions = {
  baseUrl?: string
  storage: Storage
  fetchImpl?: FetchLike
  pollMs?: number
  pushDelayMs?: number
  bootTimeoutMs?: number
  /** Notify the app that a key changed remotely. */
  onRemoteChange?: (key: string, newValue: string | null) => void
  log?: (message: string) => void
}

export type ServerStateSync = {
  readonly connected: boolean
  readonly rev: number
  boot(): Promise<'synced' | 'uploaded' | 'offline'>
  pullOnce(): Promise<number>
  flush(): Promise<void>
  start(): void
  stop(): void
  /** Called by the storage patch. */
  noteLocalWrite(key: string, value: string | null): void
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export function createServerStateSync(options: ServerStateSyncOptions): ServerStateSync {
  const base = (options.baseUrl ?? '/runtime/state').replace(/\/$/, '')
  const storage = options.storage
  const fetchImpl: FetchLike = options.fetchImpl ?? ((i, init) => fetch(i, init))
  const pollMs = options.pollMs ?? 3000
  const pushDelayMs = options.pushDelayMs ?? 400
  const log = options.log ?? (() => undefined)

  let rev = 0
  let connected = false
  const pending = new Map<string, string | null>()
  const inFlight = new Set<string>()
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let applyingRemote = false

  function localSharedKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i)
      if (isSharedKey(k)) keys.push(k)
    }
    return keys
  }

  function writeLocal(key: string, value: string | null): boolean {
    const current = storage.getItem(key)
    if (current === value) return false
    applyingRemote = true
    try {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
    } finally {
      applyingRemote = false
    }
    return true
  }

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  }

  async function putChanges(changes: Array<{ key: string; value: string | null }>): Promise<number> {
    const res = await fetchImpl(`${base}/v1/keys`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as { rev: number }
    return body.rev
  }

  async function applySnapshot(snapshot: { rev: number; keys: Record<string, string> }): Promise<void> {
    for (const [key, value] of Object.entries(snapshot.keys)) {
      if (!isSharedKey(key) || pending.has(key)) continue
      if (writeLocal(key, value)) options.onRemoteChange?.(key, value)
    }
    for (const key of localSharedKeys()) {
      if (!(key in snapshot.keys) && !pending.has(key)) {
        if (writeLocal(key, null)) options.onRemoteChange?.(key, null)
      }
    }
    rev = snapshot.rev
  }

  async function flush(): Promise<void> {
    if (pushTimer) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
    if (pending.size === 0) return
    const batch = [...pending.entries()].map(([key, value]) => ({ key, value }))
    pending.clear()
    for (const c of batch) inFlight.add(c.key)
    try {
      await putChanges(batch)
      connected = true
    } catch (error) {
      connected = false
      // Put back what was not superseded meanwhile, retry later.
      for (const c of batch) if (!pending.has(c.key)) pending.set(c.key, c.value)
      log(`push failed: ${error instanceof Error ? error.message : String(error)}`)
      schedulePush(5000)
    } finally {
      for (const c of batch) inFlight.delete(c.key)
    }
  }

  function schedulePush(delay = pushDelayMs): void {
    if (pushTimer) return
    pushTimer = setTimeout(() => {
      pushTimer = null
      void flush()
    }, delay)
    // Node (tests, headless): a pending retry must not keep the process alive.
    ;(pushTimer as { unref?: () => void }).unref?.()
  }

  async function pullOnce(): Promise<number> {
    const body = await getJson<{
      rev: number
      changes: Array<{ key: string; value: string | null; rev: number }>
      reset: boolean
    }>(`/v1/changes?since=${rev}`)
    connected = true
    if (body.reset) {
      await applySnapshot(await getJson('/v1/snapshot'))
      return -1
    }
    let applied = 0
    for (const change of body.changes) {
      if (!isSharedKey(change.key) || pending.has(change.key) || inFlight.has(change.key)) continue
      if (writeLocal(change.key, change.value)) {
        applied += 1
        options.onRemoteChange?.(change.key, change.value)
      }
    }
    rev = Math.max(rev, body.rev)
    return applied
  }

  return {
    get connected() {
      return connected
    },
    get rev() {
      return rev
    },

    async boot() {
      try {
        const snapshot = await withTimeout(
          getJson<{ rev: number; keys: Record<string, string> }>('/v1/snapshot'),
          options.bootTimeoutMs ?? 4000,
        )
        connected = true
        if (snapshot.rev === 0 && Object.keys(snapshot.keys).length === 0) {
          const local = localSharedKeys()
          if (local.length > 0) {
            rev = await putChanges(local.map((key) => ({ key, value: storage.getItem(key) })))
            log(`first device: uploaded ${local.length} keys`)
            return 'uploaded'
          }
        }
        await applySnapshot(snapshot)
        log(`synced ${Object.keys(snapshot.keys).length} keys at rev ${snapshot.rev}`)
        return 'synced'
      } catch (error) {
        connected = false
        log(`server state unavailable (${error instanceof Error ? error.message : String(error)}) — local only`)
        return 'offline'
      }
    },

    pullOnce,
    flush,

    start() {
      if (pollTimer) return
      pollTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        void pullOnce().catch(() => {
          connected = false
        })
      }, pollMs)
    },

    stop() {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
    },

    noteLocalWrite(key, value) {
      if (applyingRemote || !isSharedKey(key)) return
      pending.set(key, value)
      schedulePush()
    },
  }
}

/**
 * Route localStorage writes on shared keys into the sync. Patched on the
 * prototype (assigning to the instance would store an item named "setItem").
 */
export function patchStorageForSync(storage: Storage, sync: ServerStateSync): void {
  const proto = Object.getPrototypeOf(storage) as Storage
  const originalSet = proto.setItem
  const originalRemove = proto.removeItem
  const originalClear = proto.clear

  proto.setItem = function setItem(this: Storage, key: string, value: string) {
    originalSet.call(this, key, value)
    if (this === storage) sync.noteLocalWrite(String(key), String(value))
  }
  proto.removeItem = function removeItem(this: Storage, key: string) {
    originalRemove.call(this, key)
    if (this === storage) sync.noteLocalWrite(String(key), null)
  }
  proto.clear = function clear(this: Storage) {
    const keys: string[] = []
    if (this === storage) for (let i = 0; i < this.length; i += 1) keys.push(this.key(i) as string)
    originalClear.call(this)
    for (const k of keys) sync.noteLocalWrite(k, null)
  }
}

let active: ServerStateSync | null = null

export function getServerStateSync(): ServerStateSync | null {
  return active
}

/** main.tsx entry: boot before the app imports any store. */
export async function bootstrapServerState(enabled: boolean): Promise<void> {
  if (!enabled || typeof window === 'undefined') return
  const sync = createServerStateSync({
    storage: window.localStorage,
    onRemoteChange: (key, newValue) => {
      try {
        window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: window.localStorage }))
      } catch {
        window.dispatchEvent(new Event('storage'))
      }
    },
    log: (m) => console.info(`[server-state] ${m}`),
  })
  // Patch first so nothing the boot writes is lost; boot itself writes with
  // applyingRemote set, so it does not echo back.
  patchStorageForSync(window.localStorage, sync)
  const result = await sync.boot()
  active = sync
  sync.start()
  window.addEventListener('focus', () => void sync.pullOnce().catch(() => undefined))
  window.addEventListener('pagehide', () => void sync.flush())
  ;(window as unknown as { __aiCompanyServerState?: unknown }).__aiCompanyServerState = {
    result,
    get connected() {
      return sync.connected
    },
    get rev() {
      return sync.rev
    },
  }
}
