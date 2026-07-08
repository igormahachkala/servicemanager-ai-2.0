/**
 * Mobile Owner Decisions — full snapshot (AI-COMPANY-107F).
 * Read-only aggregation from localStorage; no fake approve.
 */

import { applyApprovalAction, loadApprovalStore, type ApprovalPriority } from '../approval/approvalStorage'
import {
  getCursorAutomationOwnerApprovalByLoopId,
  approveCursorAutomationOwnerGate,
  loadCursorAutomationOwnerApprovals,
  rejectCursorAutomationOwnerGate,
} from '../cursorAutomation/cursorAutomationOwnerApproval'
import { loadCursorAutomationRuns } from '../cursorAutomation/cursorAutomationStorage'
import { listEmployeeDailyJournalEntries } from '../employeeDailyJournal'
import { loadEmployeeWorkItems } from '../employeeWorkQueue'
import { loadMaxWorkerLoopRecords, MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import { buildJournalMemoryAndKnowledge } from '../morningReport/ownerMorningReportJournalSections'
import { getTodayDateKey } from '../workday/workdayStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'

export type MobileOwnerDecisionKind =
  | 'approval'
  | 'cursor_handoff'
  | 'cursor_owner_gate'
  | 'knowledge_candidate'
  | 'blocked_task'
  | 'worker_loop_failed'

export type MobileOwnerDecisionFilter = 'all' | 'approval' | 'cursor' | 'knowledge' | 'blocked'

export type MobileOwnerDecisionItem = {
  id: string
  kind: MobileOwnerDecisionKind
  filterKind: Exclude<MobileOwnerDecisionFilter, 'all'>
  title: string
  reason: string | null
  risk: string | null
  employeeId: string | null
  employeeLabel: string
  createdAt: string | null
  href: string
  canApprove: boolean
  canReject: boolean
  approvalId: string | null
  maxWorkerLoopId: string | null
}

const CURSOR_ATTENTION_STATUSES = new Set([
  'approval_pending',
  'planned',
  'queued',
  'running',
])

const PRIORITY_RISK_RU: Record<ApprovalPriority, string> = {
  critical: 'Критический приоритет',
  high: 'Высокий риск',
  medium: 'Средний риск',
  low: 'Низкий риск',
}

function employeeLabel(employeeId: string | null | undefined): string {
  if (!employeeId) return '—'
  return resolveEmployee(employeeId)?.codename ?? employeeId
}

function resolveFilterKind(kind: MobileOwnerDecisionKind): Exclude<MobileOwnerDecisionFilter, 'all'> {
  if (kind === 'approval') return 'approval'
  if (kind === 'knowledge_candidate') return 'knowledge'
  if (kind === 'blocked_task' || kind === 'worker_loop_failed') return 'blocked'
  return 'cursor'
}

export function buildMobileOwnerDecisionsSnapshot(
  now: Date = new Date(),
): MobileOwnerDecisionItem[] {
  const dateKey = getTodayDateKey(now)
  const items: MobileOwnerDecisionItem[] = []

  const { approvals } = loadApprovalStore()
  for (const approval of approvals.filter((item) => item.status === 'pending')) {
    items.push({
      id: `approval-${approval.id}`,
      kind: 'approval',
      filterKind: 'approval',
      title: approval.title,
      reason: approval.description || null,
      risk: PRIORITY_RISK_RU[approval.priority] ?? approval.priority,
      employeeId: approval.employeeId,
      employeeLabel: employeeLabel(approval.employeeId),
      createdAt: approval.createdAt,
      href: `/ops/approvals/${encodeURIComponent(approval.id)}`,
      canApprove: true,
      canReject: true,
      approvalId: approval.id,
      maxWorkerLoopId: null,
    })
  }

  for (const run of loadCursorAutomationRuns()) {
    if (!CURSOR_ATTENTION_STATUSES.has(run.status)) continue
    items.push({
      id: `cursor-run-${run.id}`,
      kind: 'cursor_handoff',
      filterKind: 'cursor',
      title: run.title,
      reason: run.instructions.slice(0, 200) || run.status,
      risk: 'Cursor handoff — требует контроля Owner',
      employeeId: MAX_WORKER_EMPLOYEE_ID,
      employeeLabel: employeeLabel(MAX_WORKER_EMPLOYEE_ID),
      createdAt: run.updatedAt ?? run.createdAt,
      href: run.runtimeRunId
        ? `/ops/runtime/runs/${encodeURIComponent(run.runtimeRunId)}`
        : '/ops/handoffs',
      canApprove: false,
      canReject: false,
      approvalId: null,
      maxWorkerLoopId: null,
    })
  }

  for (const record of loadCursorAutomationOwnerApprovals().filter((item) => item.status === 'pending')) {
    items.push({
      id: `cursor-approval-${record.id}`,
      kind: 'cursor_owner_gate',
      filterKind: 'cursor',
      title: 'Cursor Automation — ждёт Owner Approval',
      reason: record.handoffId ? `Handoff ${record.handoffId}` : 'Tool Branch / Owner Approval gate',
      risk: 'Внешний executor — approve перед запуском',
      employeeId: MAX_WORKER_EMPLOYEE_ID,
      employeeLabel: employeeLabel(MAX_WORKER_EMPLOYEE_ID),
      createdAt: record.createdAt,
      href: record.maxWorkerLoopId
        ? `/ops/employees/${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}/workspace`
        : '/ops/approvals',
      canApprove: true,
      canReject: true,
      approvalId: null,
      maxWorkerLoopId: record.maxWorkerLoopId,
    })
  }

  const journalEntries = listEmployeeDailyJournalEntries({ dateKey, limit: 50 })
  const { knowledge } = buildJournalMemoryAndKnowledge(journalEntries)
  for (const candidate of knowledge) {
    const sourceEntry =
      journalEntries.find((entry) => candidate.id.includes(entry.id)) ??
      journalEntries.find((entry) => entry.employeeId === MAX_WORKER_EMPLOYEE_ID) ??
      null

    items.push({
      id: candidate.id,
      kind: 'knowledge_candidate',
      filterKind: 'knowledge',
      title: candidate.headline,
      reason: candidate.detail,
      risk: 'Knowledge candidate — review перед публикацией',
      employeeId: sourceEntry?.employeeId ?? MAX_WORKER_EMPLOYEE_ID,
      employeeLabel: employeeLabel(sourceEntry?.employeeId ?? MAX_WORKER_EMPLOYEE_ID),
      createdAt: candidate.at,
      href: candidate.href ?? '/ops/task-results',
      canApprove: false,
      canReject: false,
      approvalId: null,
      maxWorkerLoopId: null,
    })
  }

  for (const item of loadEmployeeWorkItems().filter((entry) => entry.status === 'blocked')) {
    items.push({
      id: `blocked-${item.id}`,
      kind: 'blocked_task',
      filterKind: 'blocked',
      title: item.title,
      reason: item.blockedReason ?? 'Задача заблокирована в Work Queue',
      risk: 'Blocked — сотрудник не может продолжить',
      employeeId: item.employeeId,
      employeeLabel: employeeLabel(item.employeeId),
      createdAt: item.updatedAt,
      href: `/ops/employees/${encodeURIComponent(item.employeeId)}/workspace`,
      canApprove: false,
      canReject: false,
      approvalId: null,
      maxWorkerLoopId: null,
    })
  }

  for (const loop of loadMaxWorkerLoopRecords().filter((record) => record.status === 'failed')) {
    const failedPhase = loop.phases.find((phase) => phase.status === 'failed')
    items.push({
      id: `loop-failed-${loop.id}`,
      kind: 'worker_loop_failed',
      filterKind: 'blocked',
      title: loop.input.title?.trim() || loop.input.taskText.slice(0, 100),
      reason: loop.errorMessage ?? failedPhase?.detail ?? 'Worker Loop завершился с ошибкой',
      risk: 'Failed Worker Loop — требуется retry',
      employeeId: loop.employeeId,
      employeeLabel: employeeLabel(loop.employeeId),
      createdAt: loop.updatedAt ?? loop.finishedAt,
      href: `/ops/employees/${encodeURIComponent(loop.employeeId)}/workspace`,
      canApprove: false,
      canReject: false,
      approvalId: null,
      maxWorkerLoopId: loop.id,
    })
  }

  for (const loop of loadMaxWorkerLoopRecords().filter((record) => record.status === 'waiting_approval')) {
    const planReason = loop.decisionPlan?.ownerApprovalReasons.join(' · ')
    const gate = getCursorAutomationOwnerApprovalByLoopId(loop.id)
    const pendingGate = gate?.status === 'pending'
    items.push({
      id: `loop-waiting-${loop.id}`,
      kind: 'cursor_owner_gate',
      filterKind: 'cursor',
      title: loop.input.title?.trim() || 'Worker Loop — Owner Approval',
      reason: planReason ?? loop.decisionPlan?.cursorAutomationReason ?? 'Decision Plan требует Owner',
      risk: 'Tool Branch — waiting approval',
      employeeId: loop.employeeId,
      employeeLabel: employeeLabel(loop.employeeId),
      createdAt: loop.updatedAt,
      href: `/ops/employees/${encodeURIComponent(loop.employeeId)}/workspace`,
      canApprove: pendingGate,
      canReject: pendingGate,
      approvalId: null,
      maxWorkerLoopId: pendingGate ? loop.id : null,
    })
  }

  return items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export function filterMobileOwnerDecisions(
  items: MobileOwnerDecisionItem[],
  filter: MobileOwnerDecisionFilter,
): MobileOwnerDecisionItem[] {
  if (filter === 'all') return items
  return items.filter((item) => item.filterKind === filter)
}

export function countMobileOwnerDecisionsByFilter(
  items: MobileOwnerDecisionItem[],
): Record<MobileOwnerDecisionFilter, number> {
  return {
    all: items.length,
    approval: items.filter((item) => item.filterKind === 'approval').length,
    cursor: items.filter((item) => item.filterKind === 'cursor').length,
    knowledge: items.filter((item) => item.filterKind === 'knowledge').length,
    blocked: items.filter((item) => item.filterKind === 'blocked').length,
  }
}

export function approveMobileOwnerDecision(item: MobileOwnerDecisionItem): boolean {
  if (item.kind === 'approval' && item.approvalId && item.canApprove) {
    return applyApprovalAction({ approvalId: item.approvalId, kind: 'approve' }) !== null
  }
  if (item.maxWorkerLoopId && item.canApprove) {
    return approveCursorAutomationOwnerGate(item.maxWorkerLoopId) !== null
  }
  return false
}

export function rejectMobileOwnerDecision(item: MobileOwnerDecisionItem): boolean {
  if (item.kind === 'approval' && item.approvalId && item.canReject) {
    return applyApprovalAction({ approvalId: item.approvalId, kind: 'reject' }) !== null
  }
  if (item.maxWorkerLoopId && item.canReject) {
    return rejectCursorAutomationOwnerGate(item.maxWorkerLoopId) !== null
  }
  return false
}

export function resolveMobileOwnerDecisionFilterKind(
  kind: MobileOwnerDecisionKind,
): Exclude<MobileOwnerDecisionFilter, 'all'> {
  return resolveFilterKind(kind)
}
