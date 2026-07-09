/**
 * Mobile employee chat V1 — localStorage persistence (AI-COMPANY-110A).
 */

import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  MOBILE_EMPLOYEE_CHAT_STORAGE_KEY,
  MOBILE_EMPLOYEE_CHAT_SYNC_EVENT,
  MOBILE_EMPLOYEE_CHAT_VERSION,
  buildWelcomeChatMessage,
  createMobileEmployeeChatMessageId,
  parseMobileEmployeeChatStore,
  type MobileEmployeeChatMessage,
  type MobileEmployeeChatSession,
  type MobileEmployeeChatStore,
} from './mobileEmployeeChat'

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILE_EMPLOYEE_CHAT_SYNC_EVENT))
}

function emptyStore(): MobileEmployeeChatStore {
  return { version: MOBILE_EMPLOYEE_CHAT_VERSION, sessions: {} }
}

export function loadMobileEmployeeChatStore(): MobileEmployeeChatStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = localStorage.getItem(MOBILE_EMPLOYEE_CHAT_STORAGE_KEY)
    if (!raw) return emptyStore()
    return parseMobileEmployeeChatStore(JSON.parse(raw)) ?? emptyStore()
  } catch {
    return emptyStore()
  }
}

export function saveMobileEmployeeChatStore(store: MobileEmployeeChatStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MOBILE_EMPLOYEE_CHAT_STORAGE_KEY, JSON.stringify(store))
    emitSync()
  } catch {
    /* noop */
  }
}

export function getMobileEmployeeChatSession(
  employeeId: string,
  welcomeCopy?: { welcome: string },
): MobileEmployeeChatSession {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const store = loadMobileEmployeeChatStore()
  const existing = store.sessions[canonical]
  if (existing) return existing

  const session: MobileEmployeeChatSession = {
    version: MOBILE_EMPLOYEE_CHAT_VERSION,
    employeeId: canonical,
    messages: welcomeCopy ? [buildWelcomeChatMessage(welcomeCopy)] : [],
    updatedAt: nowIso(),
  }
  saveMobileEmployeeChatStore({
    ...store,
    sessions: { ...store.sessions, [canonical]: session },
  })
  return session
}

export function appendMobileEmployeeChatMessage(
  employeeId: string,
  message: Omit<MobileEmployeeChatMessage, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: string
  },
): MobileEmployeeChatMessage {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const store = loadMobileEmployeeChatStore()
  const session =
    store.sessions[canonical] ??
    ({
      version: MOBILE_EMPLOYEE_CHAT_VERSION,
      employeeId: canonical,
      messages: [],
      updatedAt: nowIso(),
    } satisfies MobileEmployeeChatSession)

  const nextMessage: MobileEmployeeChatMessage = {
    ...message,
    id: message.id ?? createMobileEmployeeChatMessageId(),
    createdAt: message.createdAt ?? nowIso(),
  }

  const updated: MobileEmployeeChatSession = {
    ...session,
    messages: [...session.messages, nextMessage],
    updatedAt: nowIso(),
  }

  saveMobileEmployeeChatStore({
    ...store,
    sessions: { ...store.sessions, [canonical]: updated },
  })

  return nextMessage
}

export function updateMobileEmployeeChatMessage(
  employeeId: string,
  messageId: string,
  patch: Partial<MobileEmployeeChatMessage>,
): MobileEmployeeChatMessage | null {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const store = loadMobileEmployeeChatStore()
  const session = store.sessions[canonical]
  if (!session) return null

  const index = session.messages.findIndex((item) => item.id === messageId)
  if (index < 0) return null

  const nextMessages = [...session.messages]
  nextMessages[index] = { ...nextMessages[index], ...patch }

  saveMobileEmployeeChatStore({
    ...store,
    sessions: {
      ...store.sessions,
      [canonical]: { ...session, messages: nextMessages, updatedAt: nowIso() },
    },
  })

  return nextMessages[index]
}

export function clearMobileEmployeeChatSession(employeeId: string): void {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const store = loadMobileEmployeeChatStore()
  if (!store.sessions[canonical]) return
  const next = { ...store.sessions }
  delete next[canonical]
  saveMobileEmployeeChatStore({ ...store, sessions: next })
}
