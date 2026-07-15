import { useSyncExternalStore } from 'react'

export type AppToastTone = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  /** Set for rich notification toasts; absent for simple action toasts. */
  title?: string
  message: string
  tone: AppToastTone
  createdAt: number
  onClick?: () => void
}

const TOAST_MS = 4800
const MAX_TOASTS = 5

let toasts: ToastItem[] = []
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return toasts
}

function getServerSnapshot() {
  return toasts
}

function makeId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function schedule(id: string) {
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, TOAST_MS)
}

/** Simple action-feedback toast (backward compatible). */
export function pushToast(message: string, tone: AppToastTone = 'info') {
  const trimmed = (message || '').trim()
  if (!trimmed) return
  const id = makeId()
  toasts = [...toasts, { id, message: trimmed, tone, createdAt: Date.now() }].slice(-MAX_TOASTS)
  emit()
  schedule(id)
}

/** Rich notification toast with title, optional body, and click handler. */
export function pushRichToast(opts: {
  title: string
  body?: string
  tone?: AppToastTone
  onClick?: () => void
}) {
  const { title, body = '', tone = 'info', onClick } = opts
  const trimmedTitle = (title || '').trim()
  if (!trimmedTitle) return
  const id = makeId()
  toasts = [
    ...toasts,
    { id, title: trimmedTitle, message: body.trim(), tone, createdAt: Date.now(), onClick },
  ].slice(-MAX_TOASTS)
  emit()
  schedule(id)
}

export function useAppToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
