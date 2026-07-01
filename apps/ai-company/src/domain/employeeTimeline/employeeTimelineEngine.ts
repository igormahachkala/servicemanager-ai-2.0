import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import type { Approval } from '../approval/approval'
import { loadApprovalStore } from '../approval/approvalStorage'
import type { CompanyEvent } from '../events/event'
import { loadEvents } from '../events/eventStorage'
import type { EventType } from '../events/eventType'
import { getHandoffById, listHandoffs } from '../handoff/handoffStorage'
import { getEvolutionForEmployee } from '../memoryEvolution/memoryEvolutionStorage'
import { getProjectById } from '../projects/project'
import { getDeliveryTaskById } from '../tasks/taskStorage'
import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import { loadTaskResults } from '../taskResults/taskResultStorage'
import type {
  EmployeeTimelineEntry,
  EmployeeTimelineKind,
  EmployeeTimelinePeriod,
  EmployeeTimelineSummary,
} from './employeeTimeline'

const TIMELINE_EVENT_TYPES = new Set<EventType>([
  'runtime.completed',
  'task_result.approved',
  'knowledge.updated',
  'memory.evolved',
  'handoff.created',
  'handoff.accepted',
  'approval.granted',
])

function resolveProjectLabel(projectId: string | null | undefined): {
  projectId: string | null
  projectLabel: string | null
} {
  if (!projectId) return { projectId: null, projectLabel: null }
  const project = getProjectById(projectId)
  return { projectId, projectLabel: project?.title ?? projectId }
}

function metadataString(event: CompanyEvent, key: string): string | null {
  const value = event.metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function mapEventToKind(event: CompanyEvent): EmployeeTimelineKind | null {
  switch (event.type) {
    case 'runtime.completed':
      return 'runtime_completed'
    case 'task_result.approved':
      return 'task_approved'
    case 'knowledge.updated':
      return 'knowledge_learned'
    case 'memory.evolved':
      return 'memory_evolved'
    case 'handoff.created':
      return 'handoff_created'
    case 'handoff.accepted': {
      const target =
        metadataString(event, 'target') ??
        getHandoffById(event.sourceId)?.target ??
        null
      if (target === 'qa') return 'qa_passed'
      if (target === 'devops') return 'production_approved'
      return null
    }
    case 'approval.granted': {
      const haystack = [
        metadataString(event, 'subject'),
        metadataString(event, 'title'),
        metadataString(event, 'summary'),
        metadataString(event, 'message'),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (/prod|deploy|production|release|staging/.test(haystack)) return 'production_approved'
      return 'owner_approval'
    }
    default:
      return null
  }
}

function resolveEventHref(event: CompanyEvent): string | null {
  switch (event.sourceType) {
    case 'runtime':
      return `/ops/runtime/runs/${encodeURIComponent(event.sourceId)}`
    case 'task_result':
      return `/ops/task-results/${encodeURIComponent(event.sourceId)}`
    case 'handoff':
      return `/ops/handoffs/${encodeURIComponent(event.sourceId)}`
    case 'approval':
      return `/ops/approvals/${encodeURIComponent(event.sourceId)}`
    case 'report':
      return event.reportId ? `/ops/reports/${encodeURIComponent(event.reportId)}` : null
    case 'knowledge':
      return `/ops/knowledge/${encodeURIComponent(event.sourceId)}`
    case 'memory':
      return event.employeeId ? `/ops/employees/${encodeURIComponent(event.employeeId)}/memory` : null
    default:
      return null
  }
}

function entryFromEvent(event: CompanyEvent, kind: EmployeeTimelineKind): EmployeeTimelineEntry {
  const projectId =
    metadataString(event, 'projectId') ??
    (event.sourceType === 'handoff' ? getHandoffById(event.sourceId)?.projectId ?? null : null)
  const { projectLabel } = resolveProjectLabel(projectId)
  const description =
    metadataString(event, 'message') ??
    metadataString(event, 'title') ??
    metadataString(event, 'subject') ??
    metadataString(event, 'preview') ??
    kind

  return {
    id: `evt-${event.id}`,
    kind,
    createdAt: event.createdAt,
    projectLabel,
    projectId,
    description,
    severity: event.severity,
    href: resolveEventHref(event),
    sourceType: event.sourceType,
    sourceId: event.sourceId,
  }
}

function entryFromApproval(approval: Approval, kind: EmployeeTimelineKind): EmployeeTimelineEntry {
  const haystack = `${approval.title} ${approval.description ?? ''}`.toLowerCase()
  const resolvedKind =
    kind === 'owner_approval' &&
    (approval.actionType === 'production_deploy' || /prod|deploy|production|release|staging/.test(haystack))
      ? 'production_approved'
      : kind

  return {
    id: `approval-${approval.id}`,
    kind: resolvedKind,
    createdAt: approval.updatedAt,
    projectLabel: null,
    projectId: null,
    description: approval.description || approval.title,
    severity: 'success',
    href: `/ops/approvals/${encodeURIComponent(approval.id)}`,
    sourceType: 'approval',
    sourceId: approval.id,
  }
}

export function buildEmployeeTimeline(employeeId: string): EmployeeTimelineEntry[] {
  const canonicalId = resolveCanonicalEmployeeId(employeeId)
  const entries: EmployeeTimelineEntry[] = []
  const seen = new Set<string>()

  const push = (entry: EmployeeTimelineEntry) => {
    const key = `${entry.kind}:${entry.sourceId}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push(entry)
  }

  for (const event of loadEvents()) {
    if (event.employeeId !== canonicalId) continue
    if (!TIMELINE_EVENT_TYPES.has(event.type)) continue
    const kind = mapEventToKind(event)
    if (!kind) continue
    push(entryFromEvent(event, kind))
  }

  for (const run of loadRuntimeRuns()) {
    if (run.employeeId !== canonicalId || run.status !== 'completed') continue
    const { projectLabel, projectId } = resolveProjectLabel(projectIdFromTaskId(run.taskId))
    push({
      id: `runtime-${run.id}`,
      kind: 'runtime_completed',
      createdAt: run.finishedAt ?? run.startedAt,
      projectLabel,
      projectId,
      description:
        typeof run.result?.responseText === 'string' && run.result.responseText.trim()
          ? run.result.responseText.trim().slice(0, 160)
          : `Runtime run ${run.id} completed`,
      severity: 'success',
      href: `/ops/runtime/runs/${encodeURIComponent(run.id)}`,
      sourceType: 'runtime',
      sourceId: run.id,
    })
  }

  for (const result of loadTaskResults()) {
    if (result.employeeId !== canonicalId || result.status !== 'approved') continue
    const { projectLabel, projectId } = resolveProjectLabel(result.projectId)
    push({
      id: `task-result-${result.id}`,
      kind: 'task_approved',
      createdAt: result.updatedAt,
      projectLabel,
      projectId,
      description: result.summary || result.title,
      severity: 'success',
      href: `/ops/task-results/${encodeURIComponent(result.id)}`,
      sourceType: 'task_result',
      sourceId: result.id,
    })
  }

  for (const handoff of listHandoffs()) {
    if (handoff.employeeId !== canonicalId) continue
    const { projectLabel, projectId } = resolveProjectLabel(handoff.projectId)
    push({
      id: `handoff-${handoff.id}`,
      kind: 'handoff_created',
      createdAt: handoff.createdAt,
      projectLabel,
      projectId,
      description: handoff.description || handoff.title,
      severity: 'info',
      href: `/ops/handoffs/${encodeURIComponent(handoff.id)}`,
      sourceType: 'handoff',
      sourceId: handoff.id,
    })

    if (handoff.status === 'accepted' && handoff.target === 'qa') {
      push({
        id: `handoff-qa-${handoff.id}`,
        kind: 'qa_passed',
        createdAt: handoff.updatedAt,
        projectLabel,
        projectId,
        description: handoff.title,
        severity: 'success',
        href: `/ops/handoffs/${encodeURIComponent(handoff.id)}`,
        sourceType: 'handoff',
        sourceId: handoff.id,
      })
    }

    if (handoff.status === 'accepted' && handoff.target === 'devops') {
      push({
        id: `handoff-prod-${handoff.id}`,
        kind: 'production_approved',
        createdAt: handoff.updatedAt,
        projectLabel,
        projectId,
        description: handoff.title,
        severity: 'success',
        href: `/ops/handoffs/${encodeURIComponent(handoff.id)}`,
        sourceType: 'handoff',
        sourceId: handoff.id,
      })
    }
  }

  for (const record of getEvolutionForEmployee(canonicalId)) {
    const task = record.taskId ? getDeliveryTaskById(record.taskId) : null
    const { projectLabel, projectId } = resolveProjectLabel(task?.projectId ?? null)
    const summary =
      record.lessons[0]?.title ??
      `${record.lessons.length} lesson${record.lessons.length === 1 ? '' : 's'} captured`

    push({
      id: `memory-${record.id}`,
      kind: 'memory_evolved',
      createdAt: record.createdAt,
      projectLabel,
      projectId,
      description: summary,
      severity: 'success',
      href: record.runId ? `/ops/runtime/runs/${encodeURIComponent(record.runId)}` : null,
      sourceType: 'memory',
      sourceId: record.runId ?? record.id,
    })

    if (record.knowledgeItemIds.length > 0) {
      push({
        id: `knowledge-${record.id}`,
        kind: 'knowledge_learned',
        createdAt: record.createdAt,
        projectLabel,
        projectId,
        description: summary,
        severity: 'info',
        href: '/ops/knowledge',
        sourceType: 'knowledge',
        sourceId: record.id,
      })
    }
  }

  const approvalStore = loadApprovalStore()
  for (const approval of approvalStore.approvals) {
    if (approval.status !== 'approved' || approval.employeeId !== canonicalId) continue
    push(entryFromApproval(approval, 'owner_approval'))
  }

  return entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function projectIdFromTaskId(taskId: string | null | undefined): string | null {
  if (!taskId) return null
  return getDeliveryTaskById(taskId)?.projectId ?? null
}

export function filterEmployeeTimelineByPeriod(
  entries: EmployeeTimelineEntry[],
  period: EmployeeTimelinePeriod,
): EmployeeTimelineEntry[] {
  if (period === 'all') return entries

  const now = Date.now()
  const start =
    period === 'today'
      ? new Date()
      : new Date(now - 7 * 24 * 3600 * 1000)

  if (period === 'today') {
    start.setHours(0, 0, 0, 0)
  }

  const from = start.getTime()
  return entries.filter((entry) => new Date(entry.createdAt).getTime() >= from)
}

export function summarizeEmployeeTimeline(entries: EmployeeTimelineEntry[]): EmployeeTimelineSummary {
  return {
    total: entries.length,
    runtimeCompleted: entries.filter((item) => item.kind === 'runtime_completed').length,
    tasksApproved: entries.filter((item) => item.kind === 'task_approved').length,
    knowledgeLearned: entries.filter((item) => item.kind === 'knowledge_learned').length,
    memoryEvolved: entries.filter((item) => item.kind === 'memory_evolved').length,
  }
}
