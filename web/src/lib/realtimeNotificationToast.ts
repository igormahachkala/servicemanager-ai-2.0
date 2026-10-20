/**
 * Module-level seen-ID set shared across WS reconnects.
 * Prevents replaying toasts for notifications that arrived before the current
 * page session (backend 1-second cursor overlap on restart).
 */

const seenIds = new Set<string>()
const MAX_SEEN = 500

export type WsNotifMsg = {
  notificationId?: string
  notificationType?: string
  entityType?: string
  entityId?: string
  linkedClientCompanyId?: string | null
  createdAt?: string
}

/**
 * Returns true the first time a notificationId is seen; false on repeats.
 * Evicts oldest entry when the set exceeds MAX_SEEN.
 */
export function shouldShowNotificationToast(notificationId: string): boolean {
  if (seenIds.has(notificationId)) return false
  seenIds.add(notificationId)
  if (seenIds.size > MAX_SEEN) {
    // Set preserves insertion order; delete the oldest
    seenIds.delete(seenIds.values().next().value as string)
  }
  return true
}
