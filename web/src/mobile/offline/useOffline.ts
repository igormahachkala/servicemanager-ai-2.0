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
 * Подпись общего состояния для шапки. Порядок ветвей — по важности для
 * техника: сначала то, что требует его вмешательства.
 */
export function offlineHeadline(status: OfflineStatus): { state: OfflineSyncState | 'offline'; text: string } | null {
  if (!status.online) {
    return { state: 'offline', text: 'Нет сети' }
  }
  if (status.attention > 0) {
    return { state: 'attention', text: `${OFFLINE_SYNC_LABEL.attention}: ${status.attention}` }
  }
  if (status.syncing) {
    return { state: 'syncing', text: OFFLINE_SYNC_LABEL.syncing }
  }
  if (status.pending > 0) {
    return { state: 'pending', text: `${OFFLINE_SYNC_LABEL.pending}: ${status.pending}` }
  }
  return null
}

export { queueOffline, syncNow, OFFLINE_SYNC_LABEL }
export type { OfflineStatus }
