/**
 * Mobile Demo Mode — session + route visits (AI-COMPANY-108B).
 * Checklist completion uses real domain data; storage only tracks demo session metadata.
 */

export const MOBILE_DEMO_STORAGE_KEY = 'ai-company-mobile-demo'

export const MOBILE_DEMO_SYNC_EVENT = 'ai-company-mobile-demo-sync'

export type MobileDemoSession = {
  id: string
  startedAt: string
  visitedRoutes: string[]
}

export type MobileDemoState = {
  enabled: boolean
  session: MobileDemoSession | null
  lastResetAt: string | null
}

const DEFAULT_STATE: MobileDemoState = {
  enabled: false,
  session: null,
  lastResetAt: null,
}

function nowIso(): string {
  return new Date().toISOString()
}

function createSessionId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILE_DEMO_SYNC_EVENT))
}

function parseState(raw: unknown): MobileDemoState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE }
  const value = raw as Partial<MobileDemoState>
  const sessionRaw = value.session
  let session: MobileDemoSession | null = null
  if (sessionRaw && typeof sessionRaw === 'object') {
    const s = sessionRaw as Partial<MobileDemoSession>
    if (typeof s.id === 'string' && typeof s.startedAt === 'string') {
      session = {
        id: s.id,
        startedAt: s.startedAt,
        visitedRoutes: Array.isArray(s.visitedRoutes)
          ? s.visitedRoutes.filter((item): item is string => typeof item === 'string')
          : [],
      }
    }
  }
  return {
    enabled: value.enabled === true,
    session,
    lastResetAt: typeof value.lastResetAt === 'string' ? value.lastResetAt : null,
  }
}

export function loadMobileDemoState(): MobileDemoState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE }
  try {
    const raw = localStorage.getItem(MOBILE_DEMO_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    return parseState(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function saveMobileDemoState(state: MobileDemoState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MOBILE_DEMO_STORAGE_KEY, JSON.stringify(state))
    emitSync()
  } catch {
    /* noop */
  }
}

export function isMobileDemoModeEnabled(): boolean {
  return loadMobileDemoState().enabled
}

export function setMobileDemoModeEnabled(enabled: boolean): MobileDemoState {
  const current = loadMobileDemoState()
  const next = { ...current, enabled }
  saveMobileDemoState(next)
  return next
}

export function startMobileDemoSession(): MobileDemoSession {
  const session: MobileDemoSession = {
    id: createSessionId(),
    startedAt: nowIso(),
    visitedRoutes: [],
  }
  const next: MobileDemoState = {
    enabled: true,
    session,
    lastResetAt: nowIso(),
  }
  saveMobileDemoState(next)
  return session
}

export function markMobileDemoReset(): void {
  const current = loadMobileDemoState()
  saveMobileDemoState({ ...current, lastResetAt: nowIso() })
}

export function recordMobileDemoRouteVisit(pathname: string): void {
  const current = loadMobileDemoState()
  if (!current.enabled || !current.session) return
  const normalized = pathname.split('?')[0] ?? pathname
  if (current.session.visitedRoutes.includes(normalized)) return
  const session: MobileDemoSession = {
    ...current.session,
    visitedRoutes: [...current.session.visitedRoutes, normalized],
  }
  saveMobileDemoState({ ...current, session })
}

export function endMobileDemoSession(): void {
  const current = loadMobileDemoState()
  saveMobileDemoState({ ...current, enabled: false, session: null })
}
