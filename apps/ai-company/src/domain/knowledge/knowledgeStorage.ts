import type { Knowledge, KnowledgeStatus } from './knowledge'
import { KNOWLEDGE_STATUSES } from './knowledge'
import type { KnowledgeSource } from './knowledgeSource'
import { KNOWLEDGE_SOURCES } from './knowledgeSource'
import type { KnowledgeType } from './knowledgeType'
import { KNOWLEDGE_TYPES } from './knowledgeType'
import type { KnowledgeAssignment } from './knowledgeAssignment'
import { KNOWLEDGE_ASSIGNMENT_STATUSES } from './knowledgeAssignment'
import type { KnowledgeCollection } from './knowledgeCollection'

export type KnowledgeStore = {
  items: Knowledge[]
  assignments: KnowledgeAssignment[]
}

export type KnowledgeFilter = {
  status: KnowledgeStatus | 'all'
  type: KnowledgeType | 'all'
  source: KnowledgeSource | 'all'
  workspaceId: 'all' | 'none' | string
  tag: string | 'all'
}

export type KnowledgeStats = {
  total: number
  published: number
  draft: number
  archived: number
  collections: number
  assignments: number
  workspaceScoped: number
  platformWide: number
}

const KNOWLEDGE_KEY = 'ai-company-knowledge'
const COLLECTIONS_KEY = 'ai-company-knowledge-collections'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseStatus(value: unknown): KnowledgeStatus | null {
  return typeof value === 'string' && (KNOWLEDGE_STATUSES as readonly string[]).includes(value)
    ? (value as KnowledgeStatus)
    : null
}

function parseType(value: unknown): KnowledgeType | null {
  return typeof value === 'string' && (KNOWLEDGE_TYPES as readonly string[]).includes(value)
    ? (value as KnowledgeType)
    : null
}

function parseSource(value: unknown): KnowledgeSource | null {
  return typeof value === 'string' && (KNOWLEDGE_SOURCES as readonly string[]).includes(value)
    ? (value as KnowledgeSource)
    : null
}

function parseKnowledge(value: unknown): Knowledge | null {
  if (!isRecord(value)) return null
  const status = parseStatus(value.status)
  const type = parseType(value.type)
  const source = parseSource(value.source)
  if (
    !status ||
    !type ||
    !source ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    title: value.title,
    summary: value.summary,
    content: value.content,
    type,
    source,
    tags: parseTags(value.tags),
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    ownerEmployeeId: typeof value.ownerEmployeeId === 'string' ? value.ownerEmployeeId : null,
    status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parseAssignment(value: unknown): KnowledgeAssignment | null {
  if (!isRecord(value)) return null
  const status =
    typeof value.status === 'string' &&
    (KNOWLEDGE_ASSIGNMENT_STATUSES as readonly string[]).includes(value.status)
      ? (value.status as KnowledgeAssignment['status'])
      : null
  if (
    !status ||
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.assignedAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    employeeId: value.employeeId,
    knowledgeId: typeof value.knowledgeId === 'string' ? value.knowledgeId : null,
    collectionId: typeof value.collectionId === 'string' ? value.collectionId : null,
    status,
    note: typeof value.note === 'string' ? value.note : null,
    assignedAt: value.assignedAt,
    dueAt: typeof value.dueAt === 'string' ? value.dueAt : null,
  }
}

function parseCollection(value: unknown): KnowledgeCollection | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }
  const items = Array.isArray(value.items)
    ? value.items.filter((item): item is string => typeof item === 'string')
    : []
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    items,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadKnowledgeStore(): KnowledgeStore {
  if (typeof window === 'undefined') return { items: [], assignments: [] }
  try {
    const raw = localStorage.getItem(KNOWLEDGE_KEY)
    if (!raw) return { items: [], assignments: [] }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { items: [], assignments: [] }
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(parseKnowledge).filter((item): item is Knowledge => item !== null)
      : []
    const assignments = Array.isArray(parsed.assignments)
      ? parsed.assignments
          .map(parseAssignment)
          .filter((item): item is KnowledgeAssignment => item !== null)
      : []
    return { items, assignments }
  } catch {
    return { items: [], assignments: [] }
  }
}

export function saveKnowledgeStore(store: KnowledgeStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(store))
  } catch {
    /* noop */
  }
}

export function loadKnowledgeCollections(): KnowledgeCollection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseCollection)
      .filter((item): item is KnowledgeCollection => item !== null)
  } catch {
    return []
  }
}

export function saveKnowledgeCollections(collections: KnowledgeCollection[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
  } catch {
    /* noop */
  }
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export function ensureSeedKnowledge(): KnowledgeStore {
  const existing = loadKnowledgeStore()
  if (existing.items.length > 0) return existing

  const now = daysAgo(0)
  const store: KnowledgeStore = {
    items: [
      {
        id: 'kn-vision',
        title: 'AI Company Vision',
        summary:
          'Platform vision — digital employees, Owner control, Workspace-scoped knowledge, model independence.',
        content:
          'AI Company is a standalone platform where digital employees collaborate with a human Owner.\n\nKey principles:\n- Employee-centric identity (not model-centric)\n- Workspace contains project knowledge\n- Human is always in control\n- Reports-first and audit everything\n- Runtime requests knowledge; it never owns it',
        type: 'documentation',
        source: 'markdown',
        tags: ['platform', 'vision', 'onboarding'],
        workspaceId: null,
        ownerEmployeeId: 'ag-ceo',
        status: 'published',
        createdAt: daysAgo(30),
        updatedAt: daysAgo(5),
      },
      {
        id: 'kn-adr-001',
        title: 'ADR-001 — AI Company Platform',
        summary: 'Architecture decision record for the local V1 platform boundary and domain model.',
        content:
          'Status: Accepted\n\nDecision: AI Company V1 runs as a local React app with domain engines in localStorage.\n\nConsequences:\n- No Runtime in V1\n- Knowledge, Memory, Approval are separate engines\n- Multi-tenant patterns deferred to ServiceManager integration',
        type: 'adr',
        source: 'markdown',
        tags: ['adr', 'platform', 'architecture'],
        workspaceId: null,
        ownerEmployeeId: 'ag-arch',
        status: 'published',
        createdAt: daysAgo(28),
        updatedAt: daysAgo(10),
      },
      {
        id: 'kn-adr-002',
        title: 'ADR-002 — Tool Registry',
        summary: 'Central registry for tools/MCP — permissions, audit, and workspace scope.',
        content:
          'Status: Accepted\n\nDecision: All tool invocations go through Tool Registry.\n\nRules:\n- Employee invokes on behalf of company\n- Registry enforces permissions\n- Every invoke creates audit event\n- Workspace bindings are explicit',
        type: 'adr',
        source: 'markdown',
        tags: ['adr', 'tools', 'architecture'],
        workspaceId: 'ws-sma',
        ownerEmployeeId: 'ag-cto',
        status: 'published',
        createdAt: daysAgo(25),
        updatedAt: daysAgo(8),
      },
      {
        id: 'kn-coding-standards',
        title: 'Coding Standards',
        summary: 'TypeScript/React conventions for ai-company — file size, i18n, domain hooks pattern.',
        content:
          'Conventions:\n- Domain → hooks → pages/components\n- Files 300–500 lines ideal\n- Full-file edits in V1 tasks\n- i18n EN + RU mirror\n- localStorage seeds via ensureSeed*()\n- No Runtime calls from UI',
        type: 'standard',
        source: 'markdown',
        tags: ['engineering', 'standards'],
        workspaceId: 'ws-sma',
        ownerEmployeeId: 'ag-max',
        status: 'published',
        createdAt: daysAgo(20),
        updatedAt: daysAgo(3),
      },
      {
        id: 'kn-sma-arch',
        title: 'ServiceManager Architecture',
        summary: 'Multi-tenant NestJS backend — companyId, ticket owner CLIENT, technician bindings.',
        content:
          'Layers: Controller → Guard → Policy → Service → DB\n\nInvariants:\n- ticket owner = CLIENT\n- provider access via relationship\n- technician via TechnicianClientBinding\n- Access = Capability + Scope + Relationship',
        type: 'architecture',
        source: 'markdown',
        tags: ['servicemanager', 'architecture', 'nestjs'],
        workspaceId: 'ws-sma',
        ownerEmployeeId: 'ag-arch',
        status: 'published',
        createdAt: daysAgo(18),
        updatedAt: daysAgo(2),
      },
      {
        id: 'kn-git-workflow',
        title: 'Git Workflow',
        summary: 'Branch naming, commit format, and local build checks before merge.',
        content:
          'Workflow:\n1. feat(ai-company): scoped commits\n2. backend build → frontend build\n3. No push/deploy from agent without Approval\n4. ai-company-flow branch for platform tasks',
        type: 'instruction',
        source: 'markdown',
        tags: ['git', 'engineering', 'standards'],
        workspaceId: 'ws-sma',
        ownerEmployeeId: 'ag-devops',
        status: 'published',
        createdAt: daysAgo(15),
        updatedAt: daysAgo(1),
      },
      {
        id: 'kn-nestjs-bp',
        title: 'NestJS Best Practices',
        summary: 'Module boundaries, DTO validation, policy layer, and Prisma transaction patterns.',
        content:
          'Practices:\n- Thin controllers\n- Business logic in services\n- Policy for data access\n- companyId on every query\n- Avoid cross-tenant shortcuts',
        type: 'best_practice',
        source: 'markdown',
        tags: ['nestjs', 'engineering', 'servicemanager'],
        workspaceId: 'ws-sma',
        ownerEmployeeId: 'ag-cto',
        status: 'published',
        createdAt: daysAgo(12),
        updatedAt: now,
      },
    ],
    assignments: [
      {
        id: 'kn-asg-001',
        employeeId: 'ag-arch',
        knowledgeId: null,
        collectionId: 'col-platform',
        status: 'in_progress',
        note: 'Required reading for architecture decisions.',
        assignedAt: daysAgo(7),
        dueAt: daysAgo(-7),
      },
      {
        id: 'kn-asg-002',
        employeeId: 'ag-arch',
        knowledgeId: 'kn-sma-arch',
        collectionId: null,
        status: 'assigned',
        note: 'Deep dive before next ServiceManager integration spike.',
        assignedAt: daysAgo(3),
        dueAt: null,
      },
      {
        id: 'kn-asg-003',
        employeeId: 'ag-cto',
        knowledgeId: null,
        collectionId: 'col-platform',
        status: 'completed',
        note: 'Onboarding collection — completed at hire.',
        assignedAt: daysAgo(60),
        dueAt: null,
      },
      {
        id: 'kn-asg-004',
        employeeId: 'ag-max',
        knowledgeId: null,
        collectionId: 'col-engineering',
        status: 'in_progress',
        note: 'Follow coding standards on every ai-company task.',
        assignedAt: daysAgo(5),
        dueAt: daysAgo(-14),
      },
      {
        id: 'kn-asg-005',
        employeeId: 'ag-devops',
        knowledgeId: 'kn-git-workflow',
        collectionId: null,
        status: 'completed',
        note: null,
        assignedAt: daysAgo(30),
        dueAt: null,
      },
    ],
  }

  saveKnowledgeStore(store)

  const collections: KnowledgeCollection[] = [
    {
      id: 'col-platform',
      title: 'Platform Foundations',
      description: 'Vision, ADRs, and core platform principles every lead must know.',
      workspaceId: null,
      items: ['kn-vision', 'kn-adr-001', 'kn-adr-002'],
      createdAt: daysAgo(28),
      updatedAt: daysAgo(5),
    },
    {
      id: 'col-engineering',
      title: 'Engineering Standards',
      description: 'Coding standards, Git workflow, and NestJS practices for delivery.',
      workspaceId: 'ws-sma',
      items: ['kn-coding-standards', 'kn-git-workflow', 'kn-nestjs-bp'],
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
    },
    {
      id: 'col-servicemanager',
      title: 'ServiceManager Integration',
      description: 'Architecture and patterns for ServiceManager AI 2.0 backend work.',
      workspaceId: 'ws-sma',
      items: ['kn-sma-arch', 'kn-nestjs-bp', 'kn-adr-001'],
      createdAt: daysAgo(15),
      updatedAt: daysAgo(2),
    },
  ]

  saveKnowledgeCollections(collections)
  return store
}

export function getKnowledgeById(id: string, store?: KnowledgeStore): Knowledge | null {
  const data = store ?? loadKnowledgeStore()
  return data.items.find((item) => item.id === id) ?? null
}

export function getCollectionById(id: string): KnowledgeCollection | null {
  return loadKnowledgeCollections().find((item) => item.id === id) ?? null
}

export function getAssignmentsForEmployee(
  employeeId: string,
  store?: KnowledgeStore,
): KnowledgeAssignment[] {
  const data = store ?? loadKnowledgeStore()
  return data.assignments.filter((item) => item.employeeId === employeeId)
}

export function getKnowledgeForWorkspace(workspaceId: string, store?: KnowledgeStore): Knowledge[] {
  const data = store ?? loadKnowledgeStore()
  return data.items.filter(
    (item) => item.workspaceId === workspaceId || item.workspaceId === null,
  )
}

export function filterKnowledge(items: Knowledge[], filter: KnowledgeFilter): Knowledge[] {
  return items.filter((item) => {
    if (filter.status !== 'all' && item.status !== filter.status) return false
    if (filter.type !== 'all' && item.type !== filter.type) return false
    if (filter.source !== 'all' && item.source !== filter.source) return false
    if (filter.workspaceId === 'none' && item.workspaceId !== null) return false
    if (
      filter.workspaceId !== 'all' &&
      filter.workspaceId !== 'none' &&
      item.workspaceId !== filter.workspaceId
    ) {
      return false
    }
    if (filter.tag !== 'all' && !item.tags.includes(filter.tag)) return false
    return true
  })
}

export function searchKnowledge(items: Knowledge[], query: string): Knowledge[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    const haystack = [item.id, item.title, item.summary, item.content, ...item.tags]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function computeKnowledgeStats(
  store?: KnowledgeStore,
  collections?: KnowledgeCollection[],
): KnowledgeStats {
  const data = store ?? loadKnowledgeStore()
  const cols = collections ?? loadKnowledgeCollections()
  return {
    total: data.items.length,
    published: data.items.filter((item) => item.status === 'published').length,
    draft: data.items.filter((item) => item.status === 'draft').length,
    archived: data.items.filter((item) => item.status === 'archived').length,
    collections: cols.length,
    assignments: data.assignments.length,
    workspaceScoped: data.items.filter((item) => item.workspaceId !== null).length,
    platformWide: data.items.filter((item) => item.workspaceId === null).length,
  }
}

export function getAllTags(items: Knowledge[]): string[] {
  const tags = new Set<string>()
  for (const item of items) {
    for (const tag of item.tags) tags.add(tag)
  }
  return [...tags].sort()
}

export type CreateKnowledgeInput = {
  id?: string
  title: string
  summary: string
  content: string
  type: KnowledgeType
  source: KnowledgeSource
  tags?: string[]
  workspaceId?: string | null
  ownerEmployeeId?: string | null
  status?: Knowledge['status']
}

export function createKnowledgeItem(input: CreateKnowledgeInput): Knowledge {
  const store = loadKnowledgeStore()
  const now = new Date().toISOString()
  const item: Knowledge = {
    id: input.id ?? `kn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    summary: input.summary.trim(),
    content: input.content.trim(),
    type: input.type,
    source: input.source,
    tags: input.tags ?? [],
    workspaceId: input.workspaceId ?? null,
    ownerEmployeeId: input.ownerEmployeeId ?? null,
    status: input.status ?? 'draft',
    createdAt: now,
    updatedAt: now,
  }
  saveKnowledgeStore({ ...store, items: [item, ...store.items] })
  return item
}

/** Runtime integration — fetch published knowledge relevant to a workspace/task scope. */
export function queryKnowledgeForRuntime(input: {
  workspaceId?: string | null
  tags?: string[]
  types?: KnowledgeType[]
}): Knowledge[] {
  const store = loadKnowledgeStore()
  return store.items.filter((item) => {
    if (item.status !== 'published') return false
    if (input.workspaceId && item.workspaceId && item.workspaceId !== input.workspaceId) {
      return false
    }
    if (input.tags?.length && !input.tags.some((tag) => item.tags.includes(tag))) return false
    if (input.types?.length && !input.types.includes(item.type)) return false
    return true
  })
}

export type { Knowledge, KnowledgeStatus } from './knowledge'
export type { KnowledgeSource } from './knowledgeSource'
export type { KnowledgeType } from './knowledgeType'
export type { KnowledgeAssignment } from './knowledgeAssignment'
export type { KnowledgeCollection } from './knowledgeCollection'
