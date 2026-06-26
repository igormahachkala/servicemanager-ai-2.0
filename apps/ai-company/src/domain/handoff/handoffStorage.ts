import { appendAuditEvent } from '../audit/auditStorage'
import { createApprovalRequest } from '../approval/approvalStorage'
import { DEFAULT_COMPANY_ID } from '../company/company'
import { emitEvent } from '../events/eventStorage'
import { getProjectById } from '../projects/project'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../projects/aiPhotoLabIds'
import { loadDeliveryTasks } from '../tasks/taskStorage'
import { getWorkspaceById } from '../workspaces/workspace'
import { ensureSeedReports, loadReports, saveReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { resolveEmployee } from '../../mission-control/data/conversation'
import {
  computeHandoffStats,
  filterHandoffs,
  type Handoff,
  type HandoffChecklistItem,
  type HandoffFilter,
  type HandoffPriority,
  type HandoffResult,
  type HandoffStats,
  type HandoffStatus,
  HANDOFF_PRIORITIES,
  HANDOFF_STATUSES,
} from './handoff'
import { buildHandoffPackage } from './handoffPackage'
import type { HandoffPackage } from './handoffPackage'
import { getHandoffTemplateById, type HandoffTemplate } from './handoffTemplates'
import { isHandoffTarget, type HandoffTarget } from './handoffTarget'

const STORAGE_KEY = 'ai-company-handoffs'
const SEED_KEY = 'ai-company-handoffs-seeded'

function nowIso(): string {
  return new Date().toISOString()
}

function createHandoffId(): string {
  return `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): HandoffStatus | null {
  return typeof value === 'string' && (HANDOFF_STATUSES as readonly string[]).includes(value)
    ? (value as HandoffStatus)
    : null
}

function parsePriority(value: unknown): HandoffPriority | null {
  return typeof value === 'string' && (HANDOFF_PRIORITIES as readonly string[]).includes(value)
    ? (value as HandoffPriority)
    : null
}

function parsePackage(value: unknown): HandoffPackage | null {
  if (!isRecord(value)) return null
  if (
    typeof value.projectContext !== 'string' ||
    typeof value.taskContext !== 'string' ||
    typeof value.currentState !== 'string' ||
    typeof value.expectedResponseFormat !== 'string' ||
    !Array.isArray(value.files) ||
    !Array.isArray(value.constraints) ||
    !Array.isArray(value.commands) ||
    !Array.isArray(value.acceptanceCriteria)
  ) {
    return null
  }
  return {
    projectContext: value.projectContext,
    taskContext: value.taskContext,
    currentState: value.currentState,
    files: value.files.filter((item): item is string => typeof item === 'string'),
    constraints: value.constraints.filter((item): item is string => typeof item === 'string'),
    commands: value.commands.filter((item): item is string => typeof item === 'string'),
    acceptanceCriteria: value.acceptanceCriteria.filter((item): item is string => typeof item === 'string'),
    expectedResponseFormat: value.expectedResponseFormat,
  }
}

function parseResult(value: unknown): HandoffResult | null {
  if (!isRecord(value)) return null
  if (typeof value.summary !== 'string' || typeof value.deliveredAt !== 'string') return null
  return {
    summary: value.summary,
    deliveredAt: value.deliveredAt,
    responseFormat: typeof value.responseFormat === 'string' ? value.responseFormat : '',
    artifacts: Array.isArray(value.artifacts)
      ? value.artifacts
          .filter(isRecord)
          .map((item) => ({
            label: typeof item.label === 'string' ? item.label : 'Artifact',
            value: typeof item.value === 'string' ? item.value : '',
          }))
      : [],
    blockers: Array.isArray(value.blockers)
      ? value.blockers.filter((item): item is string => typeof item === 'string')
      : [],
    notes: typeof value.notes === 'string' ? value.notes : '',
  }
}

function parseHandoff(value: unknown): Handoff | null {
  if (!isRecord(value)) return null
  const status = parseStatus(value.status)
  const priority = parsePriority(value.priority)
  const target = typeof value.target === 'string' && isHandoffTarget(value.target) ? value.target : null
  const context = isRecord(value.context) ? value.context : null

  if (
    !status ||
    !priority ||
    !target ||
    !context ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.projectId !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.instructions !== 'string' ||
    typeof value.expectedResult !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !Array.isArray(value.constraints) ||
    !Array.isArray(value.checklist)
  ) {
    return null
  }

  const checklist: HandoffChecklistItem[] = value.checklist
    .filter(isRecord)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : `chk-${Math.random().toString(36).slice(2, 6)}`,
      label: typeof item.label === 'string' ? item.label : 'Checklist item',
      done: Boolean(item.done),
    }))

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    projectId: value.projectId,
    workspaceId: value.workspaceId,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    employeeId: value.employeeId,
    target,
    status,
    priority,
    context: {
      summary: typeof context.summary === 'string' ? context.summary : '',
      projectName: typeof context.projectName === 'string' ? context.projectName : '',
      workspaceName: typeof context.workspaceName === 'string' ? context.workspaceName : '',
      taskTitle: typeof context.taskTitle === 'string' ? context.taskTitle : null,
      employeeCodename: typeof context.employeeCodename === 'string' ? context.employeeCodename : '',
      relatedPaths: Array.isArray(context.relatedPaths)
        ? context.relatedPaths.filter((item): item is string => typeof item === 'string')
        : [],
      notes: typeof context.notes === 'string' ? context.notes : '',
    },
    instructions: value.instructions,
    expectedResult: value.expectedResult,
    constraints: value.constraints.filter((item): item is string => typeof item === 'string'),
    checklist,
    package: value.package ? parsePackage(value.package) : null,
    result: value.result ? parseResult(value.result) : null,
    approvalId: typeof value.approvalId === 'string' ? value.approvalId : null,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    templateId: typeof value.templateId === 'string' ? value.templateId : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadHandoffs(): Handoff[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseHandoff)
      .filter((item): item is Handoff => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return []
  }
}

export function saveHandoffs(handoffs: Handoff[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(handoffs))
}

export function getHandoffById(id: string): Handoff | null {
  return loadHandoffs().find((item) => item.id === id) ?? null
}

export function upsertHandoff(handoff: Handoff): Handoff {
  const items = loadHandoffs()
  const next = [handoff, ...items.filter((item) => item.id !== handoff.id)]
  saveHandoffs(next)
  return handoff
}

function patchHandoff(id: string, patch: Partial<Handoff>): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing) return null
  return upsertHandoff({ ...existing, ...patch, updatedAt: nowIso() })
}

export function listHandoffs(filter?: HandoffFilter): Handoff[] {
  const items = loadHandoffs()
  return filter ? filterHandoffs(items, filter) : items
}

export function getHandoffStats(filter?: HandoffFilter): HandoffStats {
  return computeHandoffStats(listHandoffs(filter))
}

function resolveProjectContext(projectId: string, workspaceId: string) {
  const project = getProjectById(projectId)
  const workspace = getWorkspaceById(workspaceId)
  return {
    projectTitle: project?.title ?? projectId,
    projectSummary: project?.description ?? 'Managed project in AI Company.',
    workspaceName: workspace?.name ?? workspaceId,
  }
}

function resolveTaskContext(taskId: string | null) {
  if (!taskId) return { taskTitle: null, taskDescription: null }
  const task = loadDeliveryTasks().find((item) => item.id === taskId) ?? null
  return {
    taskTitle: task?.title ?? taskId,
    taskDescription: task?.description ?? null,
  }
}

export function buildHandoffPackageForHandoff(handoff: Handoff): HandoffPackage {
  const project = resolveProjectContext(handoff.projectId, handoff.workspaceId)
  const task = resolveTaskContext(handoff.taskId)
  const template = handoff.templateId ? getHandoffTemplateById(handoff.templateId) : null

  return buildHandoffPackage({
    projectTitle: project.projectTitle,
    projectSummary: project.projectSummary,
    workspaceName: project.workspaceName,
    taskTitle: task.taskTitle ?? handoff.context.taskTitle,
    taskDescription: task.taskDescription,
    currentState:
      handoff.package?.currentState ??
      template?.packageDefaults.currentState ??
      handoff.context.summary,
    files:
      handoff.package?.files ??
      handoff.context.relatedPaths.length > 0
        ? handoff.context.relatedPaths
        : (template?.packageDefaults.files ?? []),
    constraints: handoff.constraints.length > 0 ? handoff.constraints : (template?.constraints ?? []),
    commands: handoff.package?.commands ?? template?.packageDefaults.commands ?? [],
    acceptanceCriteria:
      handoff.package?.acceptanceCriteria ?? template?.packageDefaults.acceptanceCriteria ?? [],
    expectedResponseFormat:
      handoff.package?.expectedResponseFormat ??
      template?.packageDefaults.expectedResponseFormat ??
      'Markdown summary with changed files, commands run, and blockers.',
  })
}

export type CreateHandoffInput = {
  title: string
  description: string
  projectId: string
  workspaceId: string
  taskId?: string | null
  employeeId: string
  target: HandoffTarget
  priority?: HandoffPriority
  instructions: string
  expectedResult: string
  constraints?: string[]
  checklist?: HandoffChecklistItem[]
  templateId?: string | null
  relatedPaths?: string[]
  notes?: string
}

export function createHandoff(input: CreateHandoffInput): Handoff {
  const employee = resolveEmployee(input.employeeId)
  const projectCtx = resolveProjectContext(input.projectId, input.workspaceId)
  const taskCtx = resolveTaskContext(input.taskId ?? null)
  const createdAt = nowIso()

  const handoff: Handoff = {
    id: createHandoffId(),
    title: input.title,
    description: input.description,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    taskId: input.taskId ?? null,
    employeeId: input.employeeId,
    target: input.target,
    status: 'draft',
    priority: input.priority ?? 'normal',
    context: {
      summary: input.description,
      projectName: projectCtx.projectTitle,
      workspaceName: projectCtx.workspaceName,
      taskTitle: taskCtx.taskTitle,
      employeeCodename: employee?.codename ?? input.employeeId,
      relatedPaths: input.relatedPaths ?? [],
      notes: input.notes ?? '',
    },
    instructions: input.instructions,
    expectedResult: input.expectedResult,
    constraints: input.constraints ?? [],
    checklist: input.checklist ?? [],
    package: null,
    result: null,
    approvalId: null,
    reportId: null,
    templateId: input.templateId ?? null,
    createdAt,
    updatedAt: createdAt,
  }

  upsertHandoff(handoff)
  appendAuditEvent({
    actorType: 'employee',
    actorId: handoff.employeeId,
    action: 'create',
    targetType: 'task',
    targetId: handoff.id,
    workspaceId: handoff.workspaceId,
    metadata: { target: handoff.target, mock: true },
  })
  emitEvent({
    type: 'handoff.created',
    sourceType: 'handoff',
    sourceId: handoff.id,
    employeeId: handoff.employeeId,
    workspaceId: handoff.workspaceId,
    reportId: null,
    metadata: {
      title: handoff.title,
      target: handoff.target,
      message: `Handoff draft prepared for ${handoff.target}`,
    },
    severity: 'info',
  })
  return handoff
}

export function createHandoffFromTemplate(input: {
  templateId: string
  projectId: string
  workspaceId: string
  employeeId: string
  taskId?: string | null
  titleOverride?: string
  relatedPaths?: string[]
}): Handoff {
  const template = getHandoffTemplateById(input.templateId)
  if (!template) throw new Error(`Unknown handoff template: ${input.templateId}`)

  return createHandoff({
    title: input.titleOverride ?? template.title,
    description: template.descriptionTemplate,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    taskId: input.taskId ?? null,
    employeeId: input.employeeId,
    target: template.target,
    priority: template.priority,
    instructions: template.instructions,
    expectedResult: template.expectedResult,
    constraints: template.constraints,
    checklist: template.checklist.map((item) => ({ ...item, done: false })),
    templateId: template.id,
    relatedPaths: input.relatedPaths ?? template.packageDefaults.files,
  })
}

export function prepareHandoff(id: string): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || existing.status !== 'draft') return null

  const handoffPackage = buildHandoffPackageForHandoff(existing)
  const checklist = existing.checklist.map((item) => ({ ...item, done: true }))

  return patchHandoff(id, {
    package: handoffPackage,
    checklist,
    status: 'ready',
  })
}

export function submitHandoffForApproval(id: string): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || existing.status !== 'ready') return null

  const approval = createApprovalRequest({
    title: `Handoff approval · ${existing.title}`,
    description: `Owner approval required before sending handoff to ${existing.target}.`,
    employeeId: existing.employeeId,
    workspaceId: existing.workspaceId,
    actionType: 'generic',
    priority: existing.priority === 'critical' ? 'critical' : existing.priority === 'high' ? 'high' : 'medium',
  })

  const updated = patchHandoff(id, { approvalId: approval.id })
  if (!updated) return null

  emitEvent({
    type: 'approval.requested',
    sourceType: 'handoff',
    sourceId: updated.id,
    employeeId: updated.employeeId,
    workspaceId: updated.workspaceId,
    reportId: null,
    metadata: {
      title: updated.title,
      approvalId: approval.id,
      target: updated.target,
      message: 'Owner approval required before external handoff.',
    },
    severity: 'warn',
  })
  return updated
}

export function sendHandoff(id: string): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || existing.status !== 'ready') return null

  const updated = patchHandoff(id, { status: 'sent' })
  if (!updated) return null

  emitEvent({
    type: 'handoff.sent',
    sourceType: 'handoff',
    sourceId: updated.id,
    employeeId: updated.employeeId,
    workspaceId: updated.workspaceId,
    reportId: null,
    metadata: {
      title: updated.title,
      target: updated.target,
      message: `Handoff package sent to ${updated.target} (mock — no external API).`,
    },
    severity: 'info',
  })
  return updated
}

export function markHandoffInProgress(id: string): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || existing.status !== 'sent') return null
  return patchHandoff(id, { status: 'in_progress' })
}

export function returnHandoffResult(id: string, result: Omit<HandoffResult, 'deliveredAt'>): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || (existing.status !== 'sent' && existing.status !== 'in_progress')) return null

  const payload: HandoffResult = { ...result, deliveredAt: nowIso() }
  const updated = patchHandoff(id, { status: 'returned', result: payload })
  if (!updated) return null

  emitEvent({
    type: 'handoff.returned',
    sourceType: 'handoff',
    sourceId: updated.id,
    employeeId: updated.employeeId,
    workspaceId: updated.workspaceId,
    reportId: null,
    metadata: {
      title: updated.title,
      target: updated.target,
      message: result.summary,
    },
    severity: 'success',
  })
  return updated
}

function appendHandoffReport(handoff: Handoff): Report {
  ensureSeedReports()
  const report: Report = {
    id: `report-handoff-${handoff.id}`,
    companyId: DEFAULT_COMPANY_ID,
    title: `Handoff result · ${handoff.title}`,
    type: 'operations',
    employeeId: handoff.employeeId,
    workspaceId: handoff.workspaceId,
    summary: handoff.result?.summary ?? `Handoff to ${handoff.target} closed with status ${handoff.status}.`,
    findings: [
      `Target: ${handoff.target}`,
      `Expected: ${handoff.expectedResult}`,
      ...(handoff.result?.artifacts.map((item) => `${item.label}: ${item.value}`) ?? []),
    ],
    risks: handoff.result?.blockers ?? [],
    recommendations: handoff.status === 'accepted' ? ['Promote learnings into project knowledge.'] : ['Review rejection notes and prepare a revised handoff.'],
    evidence: [
      {
        id: `ev-handoff-${handoff.id}`,
        label: 'Handoff package',
        kind: 'artifact',
        value: handoff.id,
      },
    ],
    status: 'published',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  saveReports([report, ...loadReports()])
  return report
}

export function acceptHandoff(id: string): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || existing.status !== 'returned') return null

  const report = appendHandoffReport({ ...existing, status: 'accepted' })
  const updated = patchHandoff(id, { status: 'accepted', reportId: report.id })
  if (!updated) return null

  emitEvent({
    type: 'handoff.accepted',
    sourceType: 'handoff',
    sourceId: updated.id,
    employeeId: updated.employeeId,
    workspaceId: updated.workspaceId,
    reportId: report.id,
    metadata: {
      title: updated.title,
      target: updated.target,
      message: 'Returned handoff accepted by Owner.',
    },
    severity: 'success',
  })
  return updated
}

export function rejectHandoff(id: string, reason: string): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || existing.status !== 'returned') return null

  const updated = patchHandoff(id, {
    status: 'rejected',
    result: existing.result
      ? { ...existing.result, notes: `${existing.result.notes}\nRejected: ${reason}`.trim() }
      : {
          summary: reason,
          deliveredAt: nowIso(),
          responseFormat: '',
          artifacts: [],
          blockers: [reason],
          notes: reason,
        },
  })
  if (!updated) return null

  emitEvent({
    type: 'handoff.rejected',
    sourceType: 'handoff',
    sourceId: updated.id,
    employeeId: updated.employeeId,
    workspaceId: updated.workspaceId,
    reportId: null,
    metadata: { title: updated.title, message: reason },
    severity: 'error',
  })
  return updated
}

export function cancelHandoff(id: string): Handoff | null {
  const existing = getHandoffById(id)
  if (!existing || existing.status === 'accepted' || existing.status === 'rejected') return null
  return patchHandoff(id, { status: 'cancelled' })
}

function seedPhotoLabHandoffs(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SEED_KEY) === '1') return

  const seeds: Array<{ templateId: string; title: string; employeeId: string; taskId?: string; relatedPaths?: string[]; afterCreate?: (id: string) => void }> = [
    {
      templateId: 'tpl-codex-code-task',
      title: 'Codex — stabilize MVP flow',
      employeeId: 'ag-max',
      relatedPaths: ['apps/ai-company/src/pages/', 'apps/ai-company/src/domain/projects/aiPhotoLabActivation.ts'],
      afterCreate: (id) => {
        prepareHandoff(id)
      },
    },
    {
      templateId: 'tpl-codex-code-task',
      title: 'Codex — audit PDF/report engine',
      employeeId: 'ag-max',
      relatedPaths: ['apps/ai-company/src/domain/reports/', 'apps/ai-company/src/components/reports/'],
    },
    {
      templateId: 'tpl-qa-review',
      title: 'QA — prepare demo checklist',
      employeeId: 'ag-qa',
      afterCreate: (id) => {
        prepareHandoff(id)
        sendHandoff(id)
        markHandoffInProgress(id)
      },
    },
    {
      templateId: 'tpl-devops-deployment',
      title: 'DevOps — verify deployment procedure',
      employeeId: 'ag-cto',
      relatedPaths: ['scripts/stage-deploy-public.sh'],
      afterCreate: (id) => {
        prepareHandoff(id)
      },
    },
  ]

  for (const seed of seeds) {
    const created = createHandoffFromTemplate({
      templateId: seed.templateId,
      projectId: AI_PHOTO_LAB_PROJECT_ID,
      workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
      employeeId: seed.employeeId,
      taskId: seed.taskId ?? null,
      titleOverride: seed.title,
      relatedPaths: seed.relatedPaths,
    })
    seed.afterCreate?.(created.id)
  }

  localStorage.setItem(SEED_KEY, '1')
}

export function initializeHandoffEngine(): void {
  seedPhotoLabHandoffs()
}

export function ensurePhotoLabHandoffs(): void {
  initializeHandoffEngine()
}

export type { HandoffTemplate }
