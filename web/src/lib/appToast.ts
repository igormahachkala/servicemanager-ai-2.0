import { useSyncExternalStore } from 'react'

export type AppToastTone = 'success' | 'error' | 'info'

type ToastItem = { id: string; message: string; tone: AppToastTone; createdAt: number }

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

/** Показать короткое уведомление (без внешних зависимостей). */
export function pushToast(message: string, tone: AppToastTone = 'info') {
  const trimmed = (message || '').trim()
  if (!trimmed) return
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
  toasts = [...toasts, { id, message: trimmed, tone, createdAt: Date.now() }].slice(-MAX_TOASTS)
  emit()
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, TOAST_MS)
}

export function useAppToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
