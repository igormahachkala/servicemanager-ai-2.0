import { listEmployeeDailyJournalEntries, type EmployeeDailyJournalEntry } from '../../domain/employeeDailyJournal'
import {
  loadEmployeeWorkItems,
  sortWorkItems,
  type WorkItem,
  type WorkPriority,
  type WorkStatus,
} from '../../domain/employeeWorkQueue'
import { buildMaxWorkspaceWorkQueueView } from '../../domain/maxWorkspace/maxWorkspaceWorkQueueViewModel'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveEmployee } from '../../mission-control/data/conversation'

export type MobileTaskCenterFilter = 'all' | 'active' | 'queue' | 'completed' | 'errors'

export type MobileTaskCenterItemView = {
  id: string
  title: string
  employeeId: string
  employeeLabel: string
  priority: WorkPriority
  status: WorkStatus
  timeIso: string | null
  nextRecommendation: string
  reportHref: string | null
  isActive: boolean
  isMax: boolean
}

export type MobileTasksCenterStats = {
  pending: number
  running: number
  completed: number
  failed: number
  blocked: number
}

export type MobileTasksCenterSnapshot = {
  activeTask: MobileTaskCenterItemView | null
  maxQueueItems: MobileTaskCenterItemView[]
  items: MobileTaskCenterItemView[]
  stats: MobileTasksCenterStats
  counts: Record<MobileTaskCenterFilter, number>
  maxSuggestedAction: string | null
}

function formatTimeLabel(iso: string | null): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveEmployeeLabel(item: WorkItem): string {
  const employee = resolveEmployee(item.employeeId)
  return employee?.codename ?? item.currentOwner.displayName ?? item.employeeId
}

function resolveItemTimeIso(item: WorkItem): string | null {
  if (item.status === 'completed' || item.status === 'skipped' || item.status === 'cancelled') {
    return item.completedAt ?? item.updatedAt
  }
  if (item.status === 'in_progress') return item.startedAt ?? item.updatedAt
  if (item.status === 'scheduled') return item.scheduledAt ?? item.createdAt
  return item.updatedAt ?? item.createdAt
}

function findReportHref(item: WorkItem, journalEntries: EmployeeDailyJournalEntry[]): string | null {
  const entry = journalEntries.find((journal) => {
    if (journal.taskId && journal.taskId === item.id) return true
    if (item.workerLoopId && journal.maxWorkerLoopId === item.workerLoopId) return true
    if (
      journal.employeeId === item.employeeId &&
      journal.taskTitle &&
      journal.taskTitle.trim() === item.title.trim()
    ) {
      return true
    }
    return false
  })
  return entry?.reportLinks[0]?.href ?? null
}

function resolveNextRecommendation(item: WorkItem, maxSuggestedDetail: string | null): string {
  switch (item.status) {
    case 'in_progress':
      return maxSuggestedDetail ?? 'Дождитесь завершения — задача выполняется.'
    case 'pending':
      return 'Откройте MAX и запустите задачу из очереди.'
    case 'scheduled':
      return item.scheduledAt
        ? `Запланирована на ${formatTimeLabel(item.scheduledAt) ?? item.scheduledAt}.`
        : 'Задача запланирована — дождитесь времени запуска.'
    case 'blocked':
      return item.blockedReason ?? 'Требуется решение Owner перед продолжением.'
    case 'completed':
      return 'Задача завершена — откройте отчёт или поставьте follow-up.'
    case 'skipped':
      return item.blockedReason ?? 'Задача пропущена — проверьте причину.'
    case 'cancelled':
      return 'Задача отменена.'
    default:
      return 'Проверьте статус задачи на странице MAX.'
  }
}

function mapWorkItem(
  item: WorkItem,
  activeItemId: string | null,
  journalEntries: EmployeeDailyJournalEntry[],
  maxSuggestedDetail: string | null,
): MobileTaskCenterItemView {
  return {
    id: item.id,
    title: item.title,
    employeeId: item.employeeId,
    employeeLabel: resolveEmployeeLabel(item),
    priority: item.priority,
    status: item.status,
    timeIso: resolveItemTimeIso(item),
    nextRecommendation: resolveNextRecommendation(item, maxSuggestedDetail),
    reportHref: findReportHref(item, journalEntries),
    isActive: item.id === activeItemId,
    isMax: item.employeeId === MAX_WORKER_EMPLOYEE_ID,
  }
}

function matchesFilter(item: WorkItem, filter: MobileTaskCenterFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'active':
      return (
        item.status === 'in_progress' ||
        item.status === 'pending' ||
        item.status === 'scheduled' ||
        item.status === 'blocked'
      )
    case 'queue':
      return item.status === 'pending' || item.status === 'scheduled'
    case 'completed':
      return item.status === 'completed'
    case 'errors':
      return item.status === 'skipped' || item.status === 'cancelled' || item.status === 'blocked'
    default:
      return true
  }
}

function countForFilter(items: WorkItem[], filter: MobileTaskCenterFilter): number {
  return items.filter((item) => matchesFilter(item, filter)).length
}

export function buildMobileTasksCenterSnapshot(
  filter: MobileTaskCenterFilter = 'all',
): MobileTasksCenterSnapshot {
  const rawItems = sortWorkItems(loadEmployeeWorkItems())
  const journalEntries = listEmployeeDailyJournalEntries()
  const maxQueueView = buildMaxWorkspaceWorkQueueView(MAX_WORKER_EMPLOYEE_ID)
  const maxSuggestedDetail = maxQueueView.nextSuggestedAction.detail

  const activeRaw =
    rawItems.find((item) => item.status === 'in_progress') ??
    (maxQueueView.activeItem
      ? rawItems.find((item) => item.id === maxQueueView.activeItem?.id) ?? null
      : null)

  const activeItemId = activeRaw?.id ?? null

  const mapped = rawItems.map((item) =>
    mapWorkItem(
      item,
      activeItemId,
      journalEntries,
      item.id === activeItemId ? maxSuggestedDetail : null,
    ),
  )

  const maxQueueItems = mapped.filter(
    (item) =>
      item.isMax && (item.status === 'pending' || item.status === 'scheduled') && item.id !== activeItemId,
  )

  const filteredItems = mapped.filter((item) => {
    if (activeItemId && item.id === activeItemId && filter !== 'completed' && filter !== 'errors') {
      return false
    }
    return matchesFilter(rawItems.find((raw) => raw.id === item.id)!, filter)
  })

  const stats: MobileTasksCenterStats = {
    pending: rawItems.filter((item) => item.status === 'pending' || item.status === 'scheduled').length,
    running: rawItems.filter((item) => item.status === 'in_progress').length,
    completed: rawItems.filter((item) => item.status === 'completed').length,
    failed: rawItems.filter((item) => item.status === 'skipped' || item.status === 'cancelled').length,
    blocked: rawItems.filter((item) => item.status === 'blocked').length,
  }

  return {
    activeTask: activeRaw
      ? mapWorkItem(activeRaw, activeItemId, journalEntries, maxSuggestedDetail)
      : null,
    maxQueueItems,
    items: filteredItems,
    stats,
    counts: {
      all: rawItems.length,
      active: countForFilter(rawItems, 'active'),
      queue: countForFilter(rawItems, 'queue'),
      completed: countForFilter(rawItems, 'completed'),
      errors: countForFilter(rawItems, 'errors'),
    },
    maxSuggestedAction: maxQueueView.nextSuggestedAction.title,
  }
}
