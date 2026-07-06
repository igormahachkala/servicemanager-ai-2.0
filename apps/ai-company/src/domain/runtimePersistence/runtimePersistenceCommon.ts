/**
 * Runtime Persistence V1 — общие типы контракта (AI-COMPANY-098B).
 *
 * НЕ подключено к Runtime orchestrator и существующим *Storage.ts.
 * Целевая модель для server-side persistence (NestJS + Prisma).
 *
 * @see docs/ai-company/AI-COMPANY-098B-runtime-persistence-v1.md
 */

export const RUNTIME_PERSISTENCE_CONTRACT_VERSION = 'v1' as const

export type RuntimePersistenceContractVersion = typeof RUNTIME_PERSISTENCE_CONTRACT_VERSION

/** Multi-tenant scope — обязателен для всех сущностей в production. */
export type PersistenceTenantScope = {
  companyId: string
  workspaceId: string | null
}

/** Кто владеет / инициировал запись. */
export const PERSISTENCE_OWNER_KINDS = ['human', 'employee', 'system'] as const

export type PersistenceOwnerKind = (typeof PERSISTENCE_OWNER_KINDS)[number]

export type PersistenceOwnerRef = {
  kind: PersistenceOwnerKind
  /** human → owner user id; employee → ag-*; system → 'system' */
  id: string
  displayName?: string | null
}

export type PersistenceTimestamps = {
  createdAt: string
  updatedAt: string
  /** null пока запись не завершена / не архивирована */
  finishedAt: string | null
}

/** Ссылка на другую persisted-сущность (FK в будущей БД). */
export type PersistenceEntityRef = {
  entity: RuntimePersistenceEntityKind
  id: string
}

export const RUNTIME_PERSISTENCE_ENTITY_KINDS = [
  'runtime_run',
  'worker_loop',
  'tool_invocation',
  'owner_approval',
  'memory_draft',
  'knowledge_draft',
  'cursor_automation_run',
  'report',
  'history_event',
] as const

export type RuntimePersistenceEntityKind = (typeof RUNTIME_PERSISTENCE_ENTITY_KINDS)[number]

export type PersistenceRelations = {
  /** Прямые FK — ordered для audit trail */
  refs: PersistenceEntityRef[]
}

/** Базовая persisted-запись — все сущности наследуют этот каркас. */
export type PersistenceRecordBase = {
  id: string
  version: RuntimePersistenceContractVersion
  tenant: PersistenceTenantScope
  owner: PersistenceOwnerRef
  timestamps: PersistenceTimestamps
  relations: PersistenceRelations
}

export type PersistenceListQuery = {
  companyId: string
  workspaceId?: string | null
  employeeId?: string | null
  status?: string | 'all'
  since?: string
  until?: string
  limit?: number
  cursor?: string | null
}

export type PersistenceWriteResult<T> = {
  ok: boolean
  record: T | null
  error: string | null
}
