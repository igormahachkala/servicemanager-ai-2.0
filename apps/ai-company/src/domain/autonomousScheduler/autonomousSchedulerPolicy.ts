/**
 * Autonomous Scheduler — task selection policy (AI-COMPANY-103B).
 * Scheduler decides order; Worker Loop executes.
 */

import type {
  AutonomousSchedulerQueueItem,
  AutonomousSchedulerSelection,
  AutonomousSchedulerSelectionPolicyId,
} from './autonomousScheduler'

export const AUTONOMOUS_SCHEDULER_PRIORITY_RANK: Record<
  AutonomousSchedulerQueueItem['priority'],
  number
> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function compareQueueItems(a: AutonomousSchedulerQueueItem, b: AutonomousSchedulerQueueItem): number {
  const priorityDelta =
    AUTONOMOUS_SCHEDULER_PRIORITY_RANK[b.priority] - AUTONOMOUS_SCHEDULER_PRIORITY_RANK[a.priority]
  if (priorityDelta !== 0) return priorityDelta

  const orderDelta = a.sortOrder - b.sortOrder
  if (orderDelta !== 0) return orderDelta

  return new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime()
}

function selectPriorityFifo(
  items: AutonomousSchedulerQueueItem[],
): AutonomousSchedulerSelection | null {
  const candidates = items.filter((item) => item.status === 'queued')
  if (candidates.length === 0) return null

  const sorted = [...candidates].sort(compareQueueItems)
  const item = sorted[0]
  const reason = `priority_fifo · ${item.priority} · enqueued ${item.enqueuedAt}`

  return { item, reason }
}

/** Pick the next queue item for the employee — does not mutate state. */
export function selectNextAutonomousSchedulerItem(
  items: AutonomousSchedulerQueueItem[],
  policyId: AutonomousSchedulerSelectionPolicyId = 'priority_fifo',
): AutonomousSchedulerSelection | null {
  switch (policyId) {
    case 'priority_fifo':
      return selectPriorityFifo(items)
    default:
      return selectPriorityFifo(items)
  }
}

/** List queued items in execution order without mutating. */
export function sortAutonomousSchedulerQueue(
  items: AutonomousSchedulerQueueItem[],
): AutonomousSchedulerQueueItem[] {
  return [...items]
    .filter((item) => item.status === 'queued')
    .sort(compareQueueItems)
}
