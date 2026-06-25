import type { PresenceStatus } from './presence'

export type PresenceStats = {
  total: number
  nowWorking: number
  waiting: number
  available: number
  offline: number
  inDiscussion: number
  needsAttention: number
}

const WORKING_STATUSES: PresenceStatus[] = ['working', 'busy', 'reviewing', 'learning']
const WAITING_STATUSES: PresenceStatus[] = ['waiting_approval']

export function computePresenceStats(
  records: { status: PresenceStatus }[],
): PresenceStats {
  const nowWorking = records.filter((item) => WORKING_STATUSES.includes(item.status)).length
  const waiting = records.filter((item) => WAITING_STATUSES.includes(item.status)).length
  const available = records.filter((item) => item.status === 'available').length
  const offline = records.filter((item) => item.status === 'offline').length
  const inDiscussion = records.filter((item) => item.status === 'in_discussion').length

  return {
    total: records.length,
    nowWorking,
    waiting,
    available,
    offline,
    inDiscussion,
    needsAttention: waiting + records.filter((item) => item.status === 'break').length,
  }
}

export function isPresenceWorking(status: PresenceStatus): boolean {
  return WORKING_STATUSES.includes(status)
}

export function isPresenceWaiting(status: PresenceStatus): boolean {
  return WAITING_STATUSES.includes(status)
}

export { WORKING_STATUSES, WAITING_STATUSES }
