/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
 *
 * Подписка экранов на состояние офлайн-режима. Экраны берут состояние отсюда
 * и не заводят своих слушателей `online`.
 */

import { useEffect, useState } from 'react'

import {
  getOfflineStatus,
  subscribeOfflineStatus,
  queueOffline,
  syncNow,
  type OfflineStatus,
} from './runtime.js'
import { OFFLINE_SYNC_LABEL, type OfflineSyncState } from './types.js'

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>(getOfflineStatus)
  useEffect(() => subscribeOfflineStatus(setStatus), [])
  return status
}

/**
 * Склонение «N действие/действия/действий» для баннера очереди.
 * Число 0 не показывается: вызывающий код рисует баннер только при pending > 0.
 */
export function formatPendingActionsLabel(count: number): string {
  const n = Math.max(0, Math.floor(count))
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} действие ожидает отправки`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} действия ожидают отправки`
  }
  return `${n} действий ожидают отправки`
}

/** Баннер шапки при отсутствии сети и непустой очереди. */
export function offlinePendingBannerText(count: number): string {
  return `Нет сети · ${formatPendingActionsLabel(count)}`
}

/**
 * Подпись общего состояния для шапки. Порядок ветвей — по важности для
 * техника: сначала то, что требует его вмешательства.
 */
export function offlineHeadline(status: OfflineStatus): { state: OfflineSyncState | 'offline' | 'checking'; text: string } | null {
  if (status.connectivity === 'checking' && !status.online) {
    return { state: 'checking', text: 'Проверяем связь' }
  }
  if (status.connectivity === 'offline' || !status.online) {
    if (status.pending > 0) {
      return { state: 'offline', text: offlinePendingBannerText(status.pending) }
    }
    return { state: 'offline', text: 'Нет сети' }
  }
  if (status.attention > 0) {
    return { state: 'attention', text: `${OFFLINE_SYNC_LABEL.attention}: ${status.attention}` }
  }
  if (status.syncing) {
    return { state: 'syncing', text: OFFLINE_SYNC_LABEL.syncing }
  }
  if (status.pending > 0) {
    return { state: 'pending', text: formatPendingActionsLabel(status.pending) }
  }
  return null
}

export { queueOffline, syncNow, OFFLINE_SYNC_LABEL }
export type { OfflineStatus }
