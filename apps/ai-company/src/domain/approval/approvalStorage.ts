import { appendAuditEvent } from '../audit/auditStorage'
import { OWNER_ID } from '../organization/organizationStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import type { Approval, ApprovalActionType, ApprovalPriority, ApprovalStatus } from './approval'
import {
  APPROVAL_ACTION_TYPES,
  APPROVAL_PRIORITIES,
  APPROVAL_STATUSES,
} from './approval'
import type { ApprovalActionKind, ApprovalActionRecord } from './approvalAction'
import { APPROVAL_ACTION_KINDS } from './approvalAction'
import type { ApprovalPolicy } from './approvalPolicy'
import type { ApprovalRule } from './approvalRule'
import { APPROVAL_RULES } from './approvalRule'

export type ApprovalStore = {
  approvals: Approval[]
  actions: ApprovalActionRecord[]
  policies: ApprovalPolicy[]
}

export type ApprovalFilter = {
  status: ApprovalStatus | 'all'
  actionType: ApprovalActionType | 'all'
  priority: ApprovalPriority | 'all'
  workspaceId: 'all' | string
}

export type ApprovalStats = {
  total: number
  pending: number
  approved: number
  rejected: number
  cancelled: number
  expired: number
  critical: number
}

const STORAGE_KEY = 'ai-company-approvals'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): ApprovalStatus | null {
  return typeof value === 'string' && (APPROVAL_STATUSES as readonly string[]).includes(value)
    ? (value as ApprovalStatus)
    : null
}

function parsePriority(value: unknown): ApprovalPriority | null {
  return typeof value === 'string' && (APPROVAL_PRIORITIES as readonly string[]).includes(value)
    ? (value as ApprovalPriority)
    : null
}

function parseActionType(value: unknown): ApprovalActionType | null {
  return typeof value === 'string' && (APPROVAL_ACTION_TYPES as readonly string[]).includes(value)
    ? (value as ApprovalActionType)
    : null
}

function parseRule(value: unknown): ApprovalRule | null {
  return typeof value === 'string' && (APPROVAL_RULES as readonly string[]).includes(value)
    ? (value as ApprovalRule)
    : null
}

function parseApproval(value: unknown): Approval | null {
  if (!isRecord(value)) return null
  const status = parseStatus(value.status)
  const priority = parsePriority(value.priority)
  const actionType = parseActionType(value.actionType)
  if (
    !status ||
    !priority ||
    !actionType ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.policyRule !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    employeeId: value.employeeId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    actionType,
    status,
    priority,
    policyRule: value.policyRule,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parseActionKind(value: unknown): ApprovalActionKind | null {
  return typeof value === 'string' && (APPROVAL_ACTION_KINDS as readonly string[]).includes(value)
    ? (value as ApprovalActionKind)
    : null
}

function parseApprovalAction(value: unknown): ApprovalActionRecord | null {
  if (!isRecord(value)) return null
  const kind = parseActionKind(value.kind)
  if (
    !kind ||
    typeof value.id !== 'string' ||
    typeof value.approvalId !== 'string' ||
    typeof value.actorId !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }
  const actorType = value.actorType === 'employee' ? 'employee' : 'owner'
  return {
    id: value.id,
    approvalId: value.approvalId,
    kind,
    actorId: value.actorId,
    actorType,
    comment: typeof value.comment === 'string' ? value.comment : null,
    delegateToId: typeof value.delegateToId === 'string' ? value.delegateToId : null,
    createdAt: value.createdAt,
  }
}

function parsePolicy(value: unknown): ApprovalPolicy | null {
  if (!isRecord(value)) return null
  const actionType = parseActionType(value.actionType)
  const rule = parseRule(value.rule)
  if (
    !actionType ||
    !rule ||
    typeof value.id !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.description !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    actionType,
    rule,
    label: value.label,
    description: value.description,
  }
}

export function loadApprovalStore(): ApprovalStore {
  if (typeof window === 'undefined') {
    return { approvals: [], actions: [], policies: [] }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { approvals: [], actions: [], policies: [] }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { approvals: [], actions: [], policies: [] }

    const approvals = Array.isArray(parsed.approvals)
      ? parsed.approvals.map(parseApproval).filter((item): item is Approval => item !== null)
      : []
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
          .map(parseApprovalAction)
          .filter((item): item is ApprovalActionRecord => item !== null)
      : []
    const policies = Array.isArray(parsed.policies)
      ? parsed.policies.map(parsePolicy).filter((item): item is ApprovalPolicy => item !== null)
      : []

    return { approvals, actions, policies }
  } catch {
    return { approvals: [], actions: [], policies: [] }
  }
}

export function saveApprovalStore(store: ApprovalStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* noop */
  }
}

function defaultPolicies(): ApprovalPolicy[] {
  return [
    {
      id: 'policy-github-push',
      actionType: 'github_push',
      rule: 'owner_only',
      label: 'GitHub Push',
      description: 'Every push to protected branches requires Owner approval.',
    },
    {
      id: 'policy-production-deploy',
      actionType: 'production_deploy',
      rule: 'always_required',
      label: 'Production Deploy',
      description: 'Production deploys always require explicit Owner approval.',
    },
    {
      id: 'policy-database-migration',
      actionType: 'database_migration',
      rule: 'always_required',
      label: 'Database Migration',
      description: 'Schema migrations require Owner review before execution.',
    },
    {
      id: 'policy-filesystem-delete',
      actionType: 'filesystem_delete',
      rule: 'owner_only',
      label: 'Filesystem Delete',
      description: 'Destructive filesystem operations require Owner approval.',
    },
    {
      id: 'policy-money-transfer',
      actionType: 'money_transfer',
      rule: 'owner_only',
      label: 'Money Transfer',
      description: 'Financial actions are Owner-only — no auto approve.',
    },
    {
      id: 'policy-permission-change',
      actionType: 'permission_change',
      rule: 'manager',
      label: 'Permission Change',
      description: 'Permission changes route through manager or Owner per policy.',
    },
    {
      id: 'policy-tool-connection',
      actionType: 'tool_connection',
      rule: 'workspace_admin',
      label: 'Tool Connection',
      description: 'New tool connections require workspace admin or Owner approval.',
    },
    {
      id: 'policy-workspace-assignment',
      actionType: 'workspace_assignment',
      rule: 'workspace_admin',
      label: 'Workspace Assignment',
      description: 'Assigning employees to workspaces requires admin approval.',
    },
    {
      id: 'policy-generic',
      actionType: 'generic',
      rule: 'always_required',
      label: 'Generic Critical Action',
      description: 'Fallback policy — critical actions always require human review.',
    },
  ]
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export function ensureSeedApprovals(): ApprovalStore {
  const existing = loadApprovalStore()
  if (existing.approvals.length > 0) return existing

  const now = new Date().toISOString()
  const policies = defaultPolicies()

  const store: ApprovalStore = {
    policies,
    approvals: [
      {
        id: 'appr-001',
        title: 'Push to main — servicemanager-ai',
        description:
          'Atlas (CTO) requests push of 3 commits to main branch. Runtime must not push until Owner approves.',
        employeeId: 'ag-cto',
        workspaceId: 'ws-sma',
        actionType: 'github_push',
        status: 'pending',
        priority: 'high',
        policyRule: 'owner_only',
        createdAt: daysAgo(0),
        updatedAt: daysAgo(0),
      },
      {
        id: 'appr-002',
        title: 'Production deploy — ai-company staging',
        description:
          'Helm (DevOps) requests production deploy of ai-company build 3dc5329. Requires Owner sign-off.',
        employeeId: 'ag-devops',
        workspaceId: 'ws-sma',
        actionType: 'production_deploy',
        status: 'pending',
        priority: 'critical',
        policyRule: 'always_required',
        createdAt: daysAgo(0),
        updatedAt: daysAgo(0),
      },
      {
        id: 'appr-003',
        title: 'Prisma migration — add approval_events',
        description:
          'Daedalus (Architect) proposes database migration. Runtime must create Approval Request, not run migration directly.',
        employeeId: 'ag-arch',
        workspaceId: 'ws-sma',
        actionType: 'database_migration',
        status: 'pending',
        priority: 'high',
        policyRule: 'always_required',
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
      {
        id: 'appr-004',
        title: 'Delete legacy mock data directory',
        description:
          'MAX requests deletion of deprecated mock fixtures. Destructive filesystem action — Owner review required.',
        employeeId: 'ag-max',
        workspaceId: null,
        actionType: 'filesystem_delete',
        status: 'approved',
        priority: 'medium',
        policyRule: 'owner_only',
        createdAt: daysAgo(3),
        updatedAt: daysAgo(2),
      },
      {
        id: 'appr-005',
        title: 'Connect Stripe billing tool',
        description:
          'Ledger (CFO) requests connection to Stripe MCP tool for invoice automation.',
        employeeId: 'ag-cfo',
        workspaceId: 'ws-sma',
        actionType: 'tool_connection',
        status: 'rejected',
        priority: 'high',
        policyRule: 'workspace_admin',
        createdAt: daysAgo(5),
        updatedAt: daysAgo(4),
      },
      {
        id: 'appr-006',
        title: 'Assign custom employee to V1 workspace',
        description:
          'Nova requests workspace assignment for a new custom employee. Pending Owner decision.',
        employeeId: 'ag-asst',
        workspaceId: 'ws-sma',
        actionType: 'workspace_assignment',
        status: 'pending',
        priority: 'medium',
        policyRule: 'workspace_admin',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
      {
        id: 'appr-007',
        title: 'Elevate QA permissions — production write',
        description:
          'Sentinel requests elevated permissions for production acceptance tests. Expired without Owner response.',
        employeeId: 'ag-qa',
        workspaceId: 'ws-sma',
        actionType: 'permission_change',
        status: 'expired',
        priority: 'critical',
        policyRule: 'manager',
        createdAt: daysAgo(14),
        updatedAt: daysAgo(7),
      },
    ],
    actions: [
      {
        id: 'appr-act-001',
        approvalId: 'appr-004',
        kind: 'comment',
        actorId: OWNER_ID,
        actorType: 'owner',
        comment: 'Confirm no references remain in ai-company before delete.',
        delegateToId: null,
        createdAt: daysAgo(3),
      },
      {
        id: 'appr-act-002',
        approvalId: 'appr-004',
        kind: 'approve',
        actorId: OWNER_ID,
        actorType: 'owner',
        comment: 'Approved — fixtures are unused.',
        delegateToId: null,
        createdAt: daysAgo(2),
      },
      {
        id: 'appr-act-003',
        approvalId: 'appr-005',
        kind: 'reject',
        actorId: OWNER_ID,
        actorType: 'owner',
        comment: 'Stripe integration deferred until finance policy V2.',
        delegateToId: null,
        createdAt: daysAgo(4),
      },
      {
        id: 'appr-act-004',
        approvalId: 'appr-001',
        kind: 'comment',
        actorId: OWNER_ID,
        actorType: 'owner',
        comment: 'Reviewing diff — hold until CI green.',
        delegateToId: null,
        createdAt: now,
      },
    ],
  }

  saveApprovalStore(store)

  appendAuditEvent({
    actorType: 'owner',
    actorId: OWNER_ID,
    action: 'approve',
    targetType: 'approval',
    targetId: 'appr-004',
    workspaceId: null,
    metadata: { title: 'Delete legacy mock data directory', seed: true },
  })

  appendAuditEvent({
    actorType: 'owner',
    actorId: OWNER_ID,
    action: 'reject',
    targetType: 'approval',
    targetId: 'appr-005',
    workspaceId: 'ws-sma',
    metadata: { title: 'Connect Stripe billing tool', seed: true },
  })

  return store
}

export function getPolicyForActionType(
  actionType: ApprovalActionType,
  store?: ApprovalStore,
): ApprovalPolicy | null {
  const data = store ?? loadApprovalStore()
  return data.policies.find((item) => item.actionType === actionType) ?? null
}

export function getApprovalById(id: string, store?: ApprovalStore): Approval | null {
  const data = store ?? loadApprovalStore()
  return data.approvals.find((item) => item.id === id) ?? null
}

export function getActionsForApproval(
  approvalId: string,
  store?: ApprovalStore,
): ApprovalActionRecord[] {
  const data = store ?? loadApprovalStore()
  return data.actions
    .filter((item) => item.approvalId === approvalId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function filterApprovals(approvals: Approval[], filter: ApprovalFilter): Approval[] {
  return approvals.filter((item) => {
    if (filter.status !== 'all' && item.status !== filter.status) return false
    if (filter.actionType !== 'all' && item.actionType !== filter.actionType) return false
    if (filter.priority !== 'all' && item.priority !== filter.priority) return false
    if (filter.workspaceId !== 'all') {
      if (filter.workspaceId === 'none' && item.workspaceId !== null) return false
      if (filter.workspaceId !== 'none' && item.workspaceId !== filter.workspaceId) return false
    }
    return true
  })
}

export function searchApprovals(approvals: Approval[], query: string): Approval[] {
  const q = query.trim().toLowerCase()
  if (!q) return approvals
  return approvals.filter((item) => {
    const employee = resolveEmployee(item.employeeId)
    const haystack = [
      item.id,
      item.title,
      item.description,
      item.actionType,
      item.status,
      employee?.codename ?? '',
      employee?.role ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function computeApprovalStats(approvals: Approval[]): ApprovalStats {
  return {
    total: approvals.length,
    pending: approvals.filter((item) => item.status === 'pending').length,
    approved: approvals.filter((item) => item.status === 'approved').length,
    rejected: approvals.filter((item) => item.status === 'rejected').length,
    cancelled: approvals.filter((item) => item.status === 'cancelled').length,
    expired: approvals.filter((item) => item.status === 'expired').length,
    critical: approvals.filter((item) => item.priority === 'critical').length,
  }
}

export type CreateApprovalInput = {
  title: string
  description: string
  employeeId: string
  workspaceId?: string | null
  actionType: ApprovalActionType
  priority?: ApprovalPriority
}

/** Runtime integration entry point — creates a pending approval request. */
export function createApprovalRequest(input: CreateApprovalInput): Approval {
  const store = loadApprovalStore()
  const policy = getPolicyForActionType(input.actionType, store)
  const now = new Date().toISOString()

  if (policy?.rule === 'disabled') {
    throw new Error(`Approval disabled for action type: ${input.actionType}`)
  }

  if (policy?.rule === 'auto_approve') {
    const approval: Approval = {
      id: `appr-${Date.now()}`,
      title: input.title,
      description: input.description,
      employeeId: input.employeeId,
      workspaceId: input.workspaceId ?? null,
      actionType: input.actionType,
      status: 'approved',
      priority: input.priority ?? 'medium',
      policyRule: policy.rule,
      createdAt: now,
      updatedAt: now,
    }
    store.approvals = [approval, ...store.approvals]
    saveApprovalStore(store)
    return approval
  }

  const approval: Approval = {
    id: `appr-${Date.now()}`,
    title: input.title,
    description: input.description,
    employeeId: input.employeeId,
    workspaceId: input.workspaceId ?? null,
    actionType: input.actionType,
    status: 'pending',
    priority: input.priority ?? 'medium',
    policyRule: policy?.rule ?? 'always_required',
    createdAt: now,
    updatedAt: now,
  }

  store.approvals = [approval, ...store.approvals]
  saveApprovalStore(store)

  appendAuditEvent({
    actorType: 'employee',
    actorId: input.employeeId,
    action: 'create',
    targetType: 'approval',
    targetId: approval.id,
    workspaceId: approval.workspaceId,
    metadata: { actionType: approval.actionType, title: approval.title },
  })

  return approval
}

export type ApplyApprovalActionInput = {
  approvalId: string
  kind: ApprovalActionKind
  actorId?: string
  actorType?: 'owner' | 'employee'
  comment?: string
  delegateToId?: string
}

export function applyApprovalAction(input: ApplyApprovalActionInput): Approval | null {
  const store = loadApprovalStore()
  const approval = getApprovalById(input.approvalId, store)
  if (!approval) return null

  const now = new Date().toISOString()
  const actorId = input.actorId ?? OWNER_ID
  const actorType = input.actorType ?? 'owner'

  const action: ApprovalActionRecord = {
    id: `appr-act-${Date.now()}`,
    approvalId: approval.id,
    kind: input.kind,
    actorId,
    actorType,
    comment: input.comment?.trim() || null,
    delegateToId: input.delegateToId ?? null,
    createdAt: now,
  }

  store.actions = [...store.actions, action]

  let nextStatus = approval.status
  if (input.kind === 'approve' && approval.status === 'pending') {
    nextStatus = 'approved'
  } else if (input.kind === 'reject' && approval.status === 'pending') {
    nextStatus = 'rejected'
  } else if (input.kind === 'delegate' && approval.status === 'pending') {
    nextStatus = 'pending'
  }

  const updated: Approval = { ...approval, status: nextStatus, updatedAt: now }
  store.approvals = store.approvals.map((item) => (item.id === approval.id ? updated : item))
  saveApprovalStore(store)

  if (input.kind === 'approve' || input.kind === 'reject') {
    appendAuditEvent({
      actorType: actorType === 'owner' ? 'owner' : 'employee',
      actorId,
      action: input.kind === 'approve' ? 'approve' : 'reject',
      targetType: 'approval',
      targetId: approval.id,
      workspaceId: approval.workspaceId,
      metadata: {
        title: approval.title,
        actionType: approval.actionType,
        comment: action.comment,
      },
    })
  }

  return updated
}

export function cancelApproval(approvalId: string, actorId = OWNER_ID): Approval | null {
  const store = loadApprovalStore()
  const approval = getApprovalById(approvalId, store)
  if (!approval || approval.status !== 'pending') return null

  const now = new Date().toISOString()
  const updated: Approval = { ...approval, status: 'cancelled', updatedAt: now }
  store.approvals = store.approvals.map((item) => (item.id === approvalId ? updated : item))
  store.actions = [
    ...store.actions,
    {
      id: `appr-act-${Date.now()}`,
      approvalId,
      kind: 'comment',
      actorId,
      actorType: 'owner',
      comment: 'Cancelled by Owner.',
      delegateToId: null,
      createdAt: now,
    },
  ]
  saveApprovalStore(store)
  return updated
}

export type { Approval, ApprovalActionType, ApprovalPriority, ApprovalStatus } from './approval'
export type { ApprovalActionKind, ApprovalActionRecord } from './approvalAction'
export type { ApprovalPolicy } from './approvalPolicy'
export type { ApprovalRule } from './approvalRule'
export { APPROVAL_RULES } from './approvalRule'
