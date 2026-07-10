/**
 * Mobile Owner Decisions — full snapshot (AI-COMPANY-107F).
 * Read-only aggregation from localStorage; no fake approve.
 */

import { applyApprovalAction, loadApprovalStore, type ApprovalPriority } from '../approval/approvalStorage'
import {
  formatBuilderToolDecisionConfidenceLabel,
  getBuilderToolDecisionById,
} from '../builderToolDecision'
import {
  approveToolExecutionRun,
  getToolExecutionRunByWorkerLoopId,
  listToolExecutionRuns,
  rejectToolExecutionRun,
} from '../toolExecution/toolExecutionRunStorage'
import {
  formatDelegationPlanConfidenceLabel,
  listDelegationPlans,
} from '../delegationPlan'
import { approveDelegationPlan, rejectDelegationPlan } from '../delegationPlan/delegationPlanStorage'
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
import { mobileEmployeeProfilePath, BUILDER_EMPLOYEE_ID } from '../mobileEmployee'
import { resolveEmployee } from '../../mission-control/data/conversation'

export type MobileOwnerDecisionKind =
  | 'approval'
  | 'cursor_handoff'
  | 'cursor_owner_gate'
  | 'knowledge_candidate'
  | 'blocked_task'
  | 'worker_loop_failed'
  | 'delegation_plan'
  | 'builder_tool_request'

export type MobileOwnerDecisionBuilderToolMeta = {
  toolLabel: string
  taskTitle: string
  reason: string
  fileScope: string[]
  checks: string[]
  expectedResult: string
  risk: string
  confidenceLabel: string
  workItemId: string
  workerLoopId: string
  builderProfileHref: string
  workItemHref: string
}

export type MobileOwnerDecisionDelegationMeta = {
  decidedByLabel: string
  recommendedEmployeeId: string
  recommendedLabel: string
  taskTitle: string
  confidence: number
  confidenceLabel: string
  ownerExplanation: string
  alternatives: Array<{ codename: string; note: string | null }>
  risk: string | null
  sourceTaskId: string | null
  recommendedEmployeeHref: string
  sourceTaskHref: string | null
}

export type MobileOwnerDecisionFilter = 'all' | 'approval' | 'cursor' | 'knowledge' | 'blocked' | 'delegation'

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
  delegationPlanId: string | null
  delegation: MobileOwnerDecisionDelegationMeta | null
  toolExecutionRunId: string | null
  builderTool: MobileOwnerDecisionBuilderToolMeta | null
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
  if (kind === 'delegation_plan') return 'delegation'
  if (kind === 'builder_tool_request') return 'cursor'
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
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: null,
      builderTool: null,
    })
  }

  for (const plan of listDelegationPlans({ status: 'awaiting_owner' })) {
    items.push({
      id: `delegation-${plan.id}`,
      kind: 'delegation_plan',
      filterKind: 'delegation',
      title: plan.taskTitle,
      reason: plan.ownerExplanation,
      risk: plan.risk,
      employeeId: plan.recommendedEmployeeId,
      employeeLabel: plan.recommendedEmployeeCodename,
      createdAt: plan.createdAt,
      href: mobileEmployeeProfilePath(plan.recommendedEmployeeId),
      canApprove: true,
      canReject: true,
      approvalId: null,
      maxWorkerLoopId: null,
      delegationPlanId: plan.id,
      delegation: {
        decidedByLabel: employeeLabel(plan.originEmployeeId),
        recommendedEmployeeId: plan.recommendedEmployeeId,
        recommendedLabel: plan.recommendedEmployeeCodename,
        taskTitle: plan.taskTitle,
        confidence: plan.confidence,
        confidenceLabel: formatDelegationPlanConfidenceLabel(plan.confidence),
        ownerExplanation: plan.ownerExplanation,
        alternatives: plan.alternatives.map((item) => ({
          codename: item.codename,
          note: item.whyNotChosen,
        })),
        risk: plan.risk,
        sourceTaskId: plan.sourceTaskId,
        recommendedEmployeeHref: mobileEmployeeProfilePath(plan.recommendedEmployeeId),
        sourceTaskHref: plan.sourceTaskId
          ? `/mobile/tasks?highlight=${encodeURIComponent(plan.sourceTaskId)}`
          : null,
      },
      toolExecutionRunId: null,
      builderTool: null,
    })
  }

  for (const run of listToolExecutionRuns({
    status: 'awaiting_owner',
    employeeId: BUILDER_EMPLOYEE_ID,
  }).filter((item) => item.builderToolDecisionId)) {
    const decision = getBuilderToolDecisionById(run.builderToolDecisionId ?? '')
    if (!decision) continue
    items.push({
      id: `builder-tool-${run.id}`,
      kind: 'builder_tool_request',
      filterKind: 'cursor',
      title: run.title,
      reason: decision.reason,
      risk: decision.risk === 'high' ? 'Высокий риск' : decision.risk === 'medium' ? 'Средний риск' : 'Низкий риск',
      employeeId: run.employeeId,
      employeeLabel: employeeLabel(run.employeeId),
      createdAt: run.createdAt,
      href: mobileEmployeeProfilePath(run.employeeId),
      canApprove: true,
      canReject: true,
      approvalId: null,
      maxWorkerLoopId: run.workerLoopId,
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: run.id,
      builderTool: {
        toolLabel: 'Cursor',
        taskTitle: run.title,
        reason: decision.reason,
        fileScope: decision.fileScope,
        checks: decision.checks,
        expectedResult: decision.expectedResult,
        risk: decision.risk,
        confidenceLabel: formatBuilderToolDecisionConfidenceLabel(decision.confidence),
        workItemId: run.workItemId,
        workerLoopId: run.workerLoopId ?? '',
        builderProfileHref: mobileEmployeeProfilePath(run.employeeId),
        workItemHref: `/mobile/tasks?highlight=${encodeURIComponent(run.workItemId)}`,
      },
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
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: null,
      builderTool: null,
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
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: null,
      builderTool: null,
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
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: null,
      builderTool: null,
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
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: null,
      builderTool: null,
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
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: null,
      builderTool: null,
    })
  }

  for (const loop of loadMaxWorkerLoopRecords().filter((record) => record.status === 'waiting_approval')) {
    if (getToolExecutionRunByWorkerLoopId(loop.id)) continue
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
      delegationPlanId: null,
      delegation: null,
      toolExecutionRunId: null,
      builderTool: null,
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
    delegation: items.filter((item) => item.filterKind === 'delegation').length,
  }
}

export function approveMobileOwnerDecision(item: MobileOwnerDecisionItem): boolean {
  if (item.kind === 'builder_tool_request' && item.toolExecutionRunId && item.canApprove) {
    return approveToolExecutionRun(
      item.toolExecutionRunId,
      'Cursor разрешён Owner — ready for local adapter',
    ) !== null
  }
  if (item.kind === 'delegation_plan' && item.delegationPlanId && item.canApprove) {
    return approveDelegationPlan(item.delegationPlanId) !== null
  }
  if (item.kind === 'approval' && item.approvalId && item.canApprove) {
    return applyApprovalAction({ approvalId: item.approvalId, kind: 'approve' }) !== null
  }
  if (item.maxWorkerLoopId && item.canApprove) {
    return approveCursorAutomationOwnerGate(item.maxWorkerLoopId) !== null
  }
  return false
}

export function rejectMobileOwnerDecision(item: MobileOwnerDecisionItem): boolean {
  if (item.kind === 'builder_tool_request' && item.toolExecutionRunId && item.canReject) {
    return rejectToolExecutionRun(item.toolExecutionRunId, 'Owner отклонил запрос Cursor') !== null
  }
  if (item.kind === 'delegation_plan' && item.delegationPlanId && item.canReject) {
    return rejectDelegationPlan(item.delegationPlanId) !== null
  }
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
