import type { Role } from '../../lib/api'
import { isShiftGateSubjectRole } from '../mobileShiftGate'

/**
 * SMA-MOBILE-SERVICE-OS Phase 0+1 — чистая логика статуса смены на Главной.
 *
 * Источник данных — тот же canonical workforce-state (`/workforce/me`,
 * queryKey ['workforce-me']), что и у модалки shift-gate. Второго механизма
 * смены не вводится: здесь только форматирование для постоянного индикатора.
 * «Субъекты смены» берём из canonical-хелпера (TECHNICIAN/MASTER).
 */

export function shouldShowHomeShiftStatus(role?: Role | null): boolean {
  return isShiftGateSubjectRole(role as string | null | undefined)
}

export type HomeShiftView =
  | { state: 'active'; durationLabel: string }
  | { state: 'inactive' }
  | { state: 'unknown' }

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** Длительность смены как HH:MM от openedAt до now. Неизвестное/битое → 00:00. */
export function formatShiftDuration(openedAtIso?: string | null, nowMs: number = Date.now()): string {
  if (!openedAtIso) return '00:00'
  const start = Date.parse(openedAtIso)
  if (Number.isNaN(start)) return '00:00'
  const diffMin = Math.max(0, Math.floor((nowMs - start) / 60000))
  const hours = Math.floor(diffMin / 60)
  const minutes = diffMin % 60
  return `${pad2(hours)}:${pad2(minutes)}`
}

export function homeShiftView(
  state: { shift?: { status?: string | null; openedAt?: string | null } | null } | null | undefined,
  nowMs: number = Date.now(),
): HomeShiftView {
  if (!state) return { state: 'unknown' }
  if (state.shift?.status === 'OPEN') {
    return { state: 'active', durationLabel: formatShiftDuration(state.shift.openedAt, nowMs) }
  }
  return { state: 'inactive' }
}
