import { appendAuditEvent } from '../audit/auditStorage'
import { createHandoffFromTemplate, prepareHandoff } from '../handoff/handoffStorage'
import { OWNER_ID } from '../organization/organizationStorage'
import { emitEvent } from '../events/eventStorage'
import { emitNotification } from '../notifications/notificationStorage'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../projects/aiPhotoLabIds'
import { loadReports, saveReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { addDeliveryTask, getDeliveryTaskById, loadDeliveryTasks, saveDeliveryTasks } from '../tasks/taskStorage'
import type { DeliveryTaskStatus } from '../tasks/task'
import {
  TASK_RESULT_REVIEW_ACTIONS,
  TASK_RESULT_STATUSES,
  type TaskResult,
  type TaskResultFilter,
  type TaskResultReviewActionKind,
  type TaskResultReviewEntry,
  type TaskResultStats,
  type TaskResultStatus,
} from './taskResult'

const STORAGE_KEY = 'ai-company-task-results'
const SEED_KEY = 'ai-company-task-results-seeded'

function nowIso(): string {
  return new Date().toISOString()
}

function createReviewEntryId(): string {
  return `tr-review-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function createTaskResultId(): string {
  return `task-result-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): TaskResultStatus | null {
  return typeof value === 'string' && (TASK_RESULT_STATUSES as readonly string[]).includes(value)
    ? (value as TaskResultStatus)
    : null
}

function parseReviewKind(value: unknown): TaskResultReviewActionKind | null {
  return typeof value === 'string' &&
    (TASK_RESULT_REVIEW_ACTIONS as readonly string[]).includes(value)
    ? (value as TaskResultReviewActionKind)
    : null
}

function parseReviewEntry(value: unknown): TaskResultReviewEntry | null {
  if (!isRecord(value)) return null
  const kind = parseReviewKind(value.kind)
  if (
    !kind ||
    typeof value.id !== 'string' ||
    typeof value.actorId !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    kind,
    actorId: value.actorId,
    actorType: value.actorType === 'employee' ? 'employee' : 'owner',
    comment: typeof value.comment === 'string' ? value.comment : null,
    createdAt: value.createdAt,
  }
}

function parseTaskResult(value: unknown): TaskResult | null {
  if (!isRecord(value)) return null
  const status = parseStatus(value.status)
  if (
    !status ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const findings = Array.isArray(value.findings)
    ? value.findings.filter((item): item is string => typeof item === 'string')
    : []

  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts
        .map((item): TaskResult['artifacts'][number] | null => {
          if (!isRecord(item)) return null
          if (typeof item.label !== 'string' || typeof item.value !== 'string') return null
          return { label: item.label, value: item.value }
        })
        .filter((item): item is TaskResult['artifacts'][number] => item !== null)
    : []

  const reviewHistory = Array.isArray(value.reviewHistory)
    ? value.reviewHistory.map(parseReviewEntry).filter((item): item is TaskResultReviewEntry => item !== null)
    : []

  return {
    id: value.id,
    title: value.title,
    summary: value.summary,
    employeeId: value.employeeId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    approvalId: typeof value.approvalId === 'string' ? value.approvalId : null,
    handoffId: typeof value.handoffId === 'string' ? value.handoffId : null,
    followUpTaskId: typeof value.followUpTaskId === 'string' ? value.followUpTaskId : null,
    status,
    outputPreview: typeof value.outputPreview === 'string' ? value.outputPreview : null,
    findings,
    artifacts,
    ownerComment: typeof value.ownerComment === 'string' ? value.ownerComment : null,
    reviewHistory,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : null,
  }
}

export function loadTaskResults(): TaskResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseTaskResult)
      .filter((item): item is TaskResult => item !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch {
    return []
  }
}

export function saveTaskResults(items: TaskResult[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* noop */
  }
}

export function getTaskResultById(id: string): TaskResult | null {
  return loadTaskResults().find((item) => item.id === id) ?? null
}

function upsertTaskResult(item: TaskResult): TaskResult {
  const items = loadTaskResults()
  const next = [item, ...items.filter((entry) => entry.id !== item.id)]
  saveTaskResults(next)
  return item
}

function patchTaskResult(id: string, patch: Partial<TaskResult>): TaskResult | null {
  const existing = getTaskResultById(id)
  if (!existing) return null
  return upsertTaskResult({ ...existing, ...patch, updatedAt: nowIso() })
}

function createReviewEntry(
  entry: Omit<TaskResultReviewEntry, 'id' | 'createdAt'>,
): TaskResultReviewEntry {
  return {
    id: createReviewEntryId(),
    createdAt: nowIso(),
    ...entry,
  }
}

function updateLinkedTaskStatus(taskId: string | null, status: DeliveryTaskStatus): void {
  if (!taskId) return
  const tasks = loadDeliveryTasks()
  const index = tasks.findIndex((item) => item.id === taskId)
  if (index === -1) return
  const next = [...tasks]
  next[index] = { ...next[index], status, updatedAt: nowIso() }
  saveDeliveryTasks(next)
}

function updateLinkedReportStatus(reportId: string | null, status: Report['status']): void {
  if (!reportId) return
  const reports = loadReports()
  const index = reports.findIndex((item) => item.id === reportId)
  if (index === -1) return
  const next = [...reports]
  next[index] = { ...next[index], status, updatedAt: nowIso() }
  saveReports(next)
}

function emitTaskResultEvent(
  type:
    | 'task_result.created'
    | 'task_result.ready'
    | 'task_result.approved'
    | 'task_result.changes_requested'
    | 'task_result.rejected'
    | 'task_result.archived',
  result: TaskResult,
  message: string,
  severity: 'info' | 'success' | 'warn' | 'error' = 'info',
): void {
  const event = emitEvent({
    type,
    sourceType: 'task_result',
    sourceId: result.id,
    employeeId: result.employeeId,
    workspaceId: result.workspaceId,
    reportId: result.reportId,
    metadata: {
      title: result.title,
      message,
      taskId: result.taskId,
      projectId: result.projectId,
      status: result.status,
    },
    severity,
  })

  emitNotification({
    type: 'task',
    severity,
    employeeId: result.employeeId,
    projectId: result.projectId,
    workspaceId: result.workspaceId,
    title: result.title,
    summary: message,
    action: { href: `/ops/task-results/${encodeURIComponent(result.id)}`, label: 'Review result' },
    eventId: event.id,
  })
}

export function filterTaskResults(items: TaskResult[], filter: TaskResultFilter): TaskResult[] {
  return items.filter((item) => {
    if (filter.status !== 'all' && item.status !== filter.status) return false
    if (filter.employeeId !== 'all' && item.employeeId !== filter.employeeId) return false
    if (filter.workspaceId !== 'all' && item.workspaceId !== filter.workspaceId) return false
    if (filter.projectId !== 'all' && item.projectId !== filter.projectId) return false
    return true
  })
}

export function searchTaskResults(items: TaskResult[], query: string): TaskResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    const employee = resolveEmployee(item.employeeId)
    const haystack = [
      item.id,
      item.title,
      item.summary,
      item.status,
      item.taskId ?? '',
      employee?.codename ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function computeTaskResultStats(items: TaskResult[]): TaskResultStats {
  return {
    total: items.length,
    draft: items.filter((item) => item.status === 'draft').length,
    readyForReview: items.filter((item) => item.status === 'ready_for_review').length,
    approved: items.filter((item) => item.status === 'approved').length,
    changesRequested: items.filter((item) => item.status === 'changes_requested').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    archived: items.filter((item) => item.status === 'archived').length,
  }
}

export function createTaskResultFromRuntimeRun(run: RuntimeRun, report: Report): TaskResult {
  const existing = loadTaskResults().find((item) => item.runtimeRunId === run.id)
  if (existing) return existing

  const employee = resolveEmployee(run.employeeId)
  const task = run.taskId ? getDeliveryTaskById(run.taskId) : null
  const now = nowIso()
  const preview = report.findings[0] ?? report.summary

  const result: TaskResult = {
    id: createTaskResultId(),
    title: task?.title ?? `Runtime result · ${employee?.codename ?? run.employeeId}`,
    summary: report.summary,
    employeeId: run.employeeId,
    workspaceId: run.workspaceId,
    projectId: task?.projectId ?? null,
    taskId: run.taskId,
    runtimeRunId: run.id,
    reportId: report.id,
    approvalId: null,
    handoffId: null,
    followUpTaskId: null,
    status: 'ready_for_review',
    outputPreview: preview,
    findings: report.findings,
    artifacts: report.evidence.map((item) => ({ label: item.label, value: item.value })),
    ownerComment: null,
    reviewHistory: [
      createReviewEntry({
        kind: 'submit_for_review',
        actorId: run.employeeId,
        actorType: 'employee',
        comment: 'Runtime completed — draft report attached for Owner review.',
      }),
    ],
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
  }

  upsertTaskResult(result)
  updateLinkedTaskStatus(run.taskId, 'review')
  emitTaskResultEvent(
    'task_result.ready',
    result,
    `${employee?.codename ?? 'Employee'} submitted a task result for Owner review.`,
    'info',
  )

  appendAuditEvent({
    actorType: 'employee',
    actorId: run.employeeId,
    action: 'create',
    targetType: 'task',
    targetId: result.id,
    workspaceId: run.workspaceId,
    metadata: { title: result.title, reportId: report.id, runId: run.id },
  })

  return result
}

export type OwnerReviewInput = {
  comment?: string
  actorId?: string
}

function applyOwnerReview(
  id: string,
  kind: Extract<TaskResultReviewActionKind, 'approve' | 'request_changes' | 'reject'>,
  nextStatus: TaskResultStatus,
  input?: OwnerReviewInput,
): TaskResult | null {
  const existing = getTaskResultById(id)
  if (!existing || !['ready_for_review', 'changes_requested'].includes(existing.status)) {
    return null
  }

  const actorId = input?.actorId ?? OWNER_ID
  const comment = input?.comment?.trim() || null
  const now = nowIso()
  const review = createReviewEntry({
    kind,
    actorId,
    actorType: 'owner',
    comment,
  })

  const updated: TaskResult = {
    ...existing,
    status: nextStatus,
    ownerComment: comment,
    reviewHistory: [...existing.reviewHistory, review],
    reviewedAt: now,
    updatedAt: now,
  }

  upsertTaskResult(updated)

  if (kind === 'approve') {
    updateLinkedTaskStatus(updated.taskId, 'done')
    updateLinkedReportStatus(updated.reportId, 'published')
    emitTaskResultEvent(
      'task_result.approved',
      updated,
      comment ?? 'Owner approved the task result.',
      'success',
    )
    appendAuditEvent({
      actorType: 'owner',
      actorId,
      action: 'approve',
      targetType: 'task',
      targetId: updated.id,
      workspaceId: updated.workspaceId,
      metadata: { title: updated.title, comment },
    })
  } else if (kind === 'request_changes') {
    updateLinkedTaskStatus(updated.taskId, 'in_progress')
    emitTaskResultEvent(
      'task_result.changes_requested',
      updated,
      comment ?? 'Owner requested changes on the task result.',
      'warn',
    )
    appendAuditEvent({
      actorType: 'owner',
      actorId,
      action: 'update',
      targetType: 'task',
      targetId: updated.id,
      workspaceId: updated.workspaceId,
      metadata: { title: updated.title, comment, action: 'request_changes' },
    })
  } else {
    updateLinkedTaskStatus(updated.taskId, 'blocked')
    updateLinkedReportStatus(updated.reportId, 'archived')
    emitTaskResultEvent(
      'task_result.rejected',
      updated,
      comment ?? 'Owner rejected the task result.',
      'error',
    )
    appendAuditEvent({
      actorType: 'owner',
      actorId,
      action: 'reject',
      targetType: 'task',
      targetId: updated.id,
      workspaceId: updated.workspaceId,
      metadata: { title: updated.title, comment },
    })
  }

  return updated
}

export function approveTaskResult(id: string, input?: OwnerReviewInput): TaskResult | null {
  return applyOwnerReview(id, 'approve', 'approved', input)
}

export function requestChangesOnTaskResult(id: string, input?: OwnerReviewInput): TaskResult | null {
  return applyOwnerReview(id, 'request_changes', 'changes_requested', input)
}

export function rejectTaskResult(id: string, input?: OwnerReviewInput): TaskResult | null {
  return applyOwnerReview(id, 'reject', 'rejected', input)
}

export function archiveTaskResult(id: string, comment?: string): TaskResult | null {
  const existing = getTaskResultById(id)
  if (!existing || existing.status === 'archived') return null

  const review = createReviewEntry({
    kind: 'archive',
    actorId: OWNER_ID,
    actorType: 'owner',
    comment: comment?.trim() || 'Archived by Owner.',
  })

  const updated: TaskResult = {
    ...existing,
    status: 'archived',
    reviewHistory: [...existing.reviewHistory, review],
    updatedAt: nowIso(),
  }

  upsertTaskResult(updated)
  emitTaskResultEvent('task_result.archived', updated, 'Task result archived.', 'info')
  return updated
}

export function createFollowUpTaskFromResult(id: string, title?: string): TaskResult | null {
  const existing = getTaskResultById(id)
  if (!existing) return null

  const followUp = addDeliveryTask({
    projectId: existing.projectId ?? AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: existing.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID,
    title: title?.trim() || `Follow-up · ${existing.title}`,
    description: `Follow-up from task result ${existing.id}. ${existing.ownerComment ?? existing.summary}`,
    assigneeId: existing.employeeId,
    priority: 'medium',
    status: 'backlog',
    expectedOutput: 'Address Owner feedback and resubmit for review.',
  })

  const review = createReviewEntry({
    kind: 'create_follow_up',
    actorId: OWNER_ID,
    actorType: 'owner',
    comment: `Created follow-up task ${followUp.id}.`,
    metadata: { followUpTaskId: followUp.id },
  })

  return patchTaskResult(id, {
    followUpTaskId: followUp.id,
    reviewHistory: [...existing.reviewHistory, review],
  })
}

export function sendTaskResultToQa(id: string, comment?: string): TaskResult | null {
  const existing = getTaskResultById(id)
  if (!existing) return null

  const handoff = createHandoffFromTemplate({
    templateId: 'tpl-qa-review',
    projectId: existing.projectId ?? AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: existing.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID,
    employeeId: 'ag-qa',
    taskId: existing.taskId,
    titleOverride: `QA review · ${existing.title}`,
    relatedPaths: existing.artifacts.map((item) => item.value),
  })
  prepareHandoff(handoff.id)

  const review = createReviewEntry({
    kind: 'send_to_qa',
    actorId: OWNER_ID,
    actorType: 'owner',
    comment: comment?.trim() || `Sent to QA handoff ${handoff.id}.`,
    metadata: { handoffId: handoff.id },
  })

  return patchTaskResult(id, {
    handoffId: handoff.id,
    reviewHistory: [...existing.reviewHistory, review],
  })
}

export function sendTaskResultToCodex(id: string, comment?: string): TaskResult | null {
  const existing = getTaskResultById(id)
  if (!existing) return null

  const handoff = createHandoffFromTemplate({
    templateId: 'tpl-codex-apl-stabilize-mvp',
    projectId: existing.projectId ?? AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: existing.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID,
    employeeId: 'ag-max',
    taskId: existing.taskId,
    titleOverride: `Codex handoff · ${existing.title}`,
    relatedPaths: existing.artifacts.map((item) => item.value),
  })
  prepareHandoff(handoff.id)

  const review = createReviewEntry({
    kind: 'send_to_codex',
    actorId: OWNER_ID,
    actorType: 'owner',
    comment: comment?.trim() || `Sent to Codex handoff ${handoff.id}.`,
    metadata: { handoffId: handoff.id },
  })

  return patchTaskResult(id, {
    handoffId: handoff.id,
    reviewHistory: [...existing.reviewHistory, review],
  })
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

function seedTaskResults(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SEED_KEY) === '1') return
  if (loadTaskResults().length > 0) {
    localStorage.setItem(SEED_KEY, '1')
    return
  }

  const seeds: TaskResult[] = [
    {
      id: 'task-result-apl-max-upload',
      title: 'Audit image upload flow',
      summary: 'Upload flow traced from mobile and desktop through multer storage.',
      employeeId: 'ag-max',
      workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
      projectId: AI_PHOTO_LAB_PROJECT_ID,
      taskId: 'task-apl-004',
      runtimeRunId: 'run-apl-max-code-audit',
      reportId: null,
      approvalId: null,
      handoffId: null,
      followUpTaskId: null,
      status: 'ready_for_review',
      outputPreview: 'POST /api/photo-checks accepts multipart image up to 25MB.',
      findings: [
        'Upload endpoint validates mime type and stores under uploads/',
        'Mobile camera capture works via input capture attribute',
        'Error state shown when file exceeds limit',
      ],
      artifacts: [
        { label: 'API route', value: 'server/index.js POST /api/photo-checks' },
        { label: 'UI entry', value: 'src/App.jsx upload panel' },
      ],
      ownerComment: null,
      reviewHistory: [
        {
          id: 'tr-review-seed-1',
          kind: 'submit_for_review',
          actorId: 'ag-max',
          actorType: 'employee',
          comment: 'Runtime audit complete — ready for Owner review.',
          createdAt: hoursAgo(2),
        },
      ],
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(2),
      reviewedAt: null,
    },
    {
      id: 'task-result-apl-qa-readiness',
      title: 'QA checklist generation',
      summary: 'Draft readiness assessment for showcase inspection MVP.',
      employeeId: 'ag-qa',
      workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
      projectId: AI_PHOTO_LAB_PROJECT_ID,
      taskId: 'task-apl-010',
      runtimeRunId: 'run-apl-qa-checklist',
      reportId: 'report-apl-readiness',
      approvalId: null,
      handoffId: null,
      followUpTaskId: null,
      status: 'approved',
      outputPreview: 'Core features deployed: AI analysis, zones, chat, mobile nav.',
      findings: [
        'Production health endpoint available at /health',
        '13 delivery tasks tracked in AI Company',
      ],
      artifacts: [{ label: 'Report', value: 'report-apl-readiness' }],
      ownerComment: 'Good baseline — proceed with remaining audit tasks.',
      reviewHistory: [
        {
          id: 'tr-review-seed-2',
          kind: 'submit_for_review',
          actorId: 'ag-qa',
          actorType: 'employee',
          comment: null,
          createdAt: hoursAgo(5),
        },
        {
          id: 'tr-review-seed-3',
          kind: 'approve',
          actorId: OWNER_ID,
          actorType: 'owner',
          comment: 'Good baseline — proceed with remaining audit tasks.',
          createdAt: hoursAgo(4),
        },
      ],
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(4),
      reviewedAt: hoursAgo(4),
    },
    {
      id: 'task-result-apl-devops-deploy',
      title: 'DevOps deployment checklist',
      summary: 'Operational risks and deploy procedure validation notes.',
      employeeId: 'ag-devops',
      workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
      projectId: AI_PHOTO_LAB_PROJECT_ID,
      taskId: 'task-apl-011',
      runtimeRunId: 'run-apl-devops-deploy-checklist',
      reportId: 'report-apl-risk',
      approvalId: null,
      handoffId: null,
      followUpTaskId: null,
      status: 'changes_requested',
      outputPreview: 'PM2 and HTTPS configured on production domain.',
      findings: ['Deploy path /opt/ai-photo-lab on 194.67.92.12'],
      artifacts: [{ label: 'Report', value: 'report-apl-risk' }],
      ownerComment: 'Add rollback steps and Ollama health check to deploy doc.',
      reviewHistory: [
        {
          id: 'tr-review-seed-4',
          kind: 'submit_for_review',
          actorId: 'ag-devops',
          actorType: 'employee',
          comment: null,
          createdAt: hoursAgo(8),
        },
        {
          id: 'tr-review-seed-5',
          kind: 'request_changes',
          actorId: OWNER_ID,
          actorType: 'owner',
          comment: 'Add rollback steps and Ollama health check to deploy doc.',
          createdAt: hoursAgo(7),
        },
      ],
      createdAt: hoursAgo(9),
      updatedAt: hoursAgo(7),
      reviewedAt: hoursAgo(7),
    },
  ]

  saveTaskResults(seeds)
  localStorage.setItem(SEED_KEY, '1')
}

export function initializeTaskResultEngine(): void {
  seedTaskResults()
}

export type { TaskResult, TaskResultFilter, TaskResultStats, TaskResultStatus } from './taskResult'
