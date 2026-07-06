/**
 * Runtime Persistence V1 — инвентарь текущего localStorage (read-only reference).
 * Используется для миграции и gap analysis — не меняет runtime.
 */

import type { RuntimePersistenceEntityKind } from './runtimePersistenceCommon'

export type LocalStoragePersistenceBinding = {
  localStorageKey: string
  entityKind: RuntimePersistenceEntityKind
  domainModule: string
  domainType: string
  persisted: boolean
  /** Черновик только в snapshot — не пишется в storage сегодня */
  snapshotOnly: boolean
  notes: string
}

/** Текущие browser keys → целевые persisted-сущности. */
export const RUNTIME_PERSISTENCE_LOCAL_STORAGE_INVENTORY: LocalStoragePersistenceBinding[] = [
  {
    localStorageKey: 'ai-company-runtime-runs',
    entityKind: 'runtime_run',
    domainModule: 'runtime/runtimeOrchestrator',
    domainType: 'RuntimeRun',
    persisted: true,
    snapshotOnly: false,
    notes: 'Canonical execution; Run History derived from this.',
  },
  {
    localStorageKey: 'ai-company-max-worker-loops',
    entityKind: 'worker_loop',
    domainModule: 'maxWorkerLoop/maxWorkerLoopStorage',
    domainType: 'MaxWorkerLoopRecord',
    persisted: true,
    snapshotOnly: false,
    notes: 'Comment in storage: V2 → MaxWorkerLoopStoragePort.',
  },
  {
    localStorageKey: 'ai-company-run-history',
    entityKind: 'history_event',
    domainModule: 'run/runStorage',
    domainType: 'RunHistory',
    persisted: true,
    snapshotOnly: false,
    notes: 'UI projection + timeline; split into history_event rows in V1 backend.',
  },
  {
    localStorageKey: 'ai-company-reports',
    entityKind: 'report',
    domainModule: 'reports/reportStorage',
    domainType: 'Report',
    persisted: true,
    snapshotOnly: false,
    notes: 'companyId on Report; sync from runtime completion.',
  },
  {
    localStorageKey: 'ai-company-memory-evolution',
    entityKind: 'memory_draft',
    domainModule: 'memoryEvolution/memoryEvolutionStorage',
    domainType: 'MemoryEvolutionRecord',
    persisted: true,
    snapshotOnly: false,
    notes: 'Published evolution; Worker Loop MemoryEvolutionDraft is snapshot-only today.',
  },
  {
    localStorageKey: 'ai-company-knowledge',
    entityKind: 'knowledge_draft',
    domainModule: 'knowledge/knowledgeStorage',
    domainType: 'Knowledge',
    persisted: true,
    snapshotOnly: false,
    notes: 'Published knowledge; KnowledgeCandidateDraft from Worker Loop not persisted.',
  },
  {
    localStorageKey: 'ai-company-tool-executions',
    entityKind: 'tool_invocation',
    domainModule: 'toolExecution/toolExecutionStorage',
    domainType: 'ToolExecution',
    persisted: true,
    snapshotOnly: false,
    notes: 'Tool Registry invoke plans not persisted separately yet.',
  },
  {
    localStorageKey: 'ai-company-approvals',
    entityKind: 'owner_approval',
    domainModule: 'approval/approvalStorage',
    domainType: 'Approval',
    persisted: true,
    snapshotOnly: false,
    notes: 'OwnerApprovalGate in Worker Loop is ephemeral snapshot field.',
  },
  {
    localStorageKey: 'ai-company-cursor-automation-runs',
    entityKind: 'cursor_automation_run',
    domainModule: 'cursorAutomation/cursorAutomationStorage',
    domainType: 'CursorAutomationTask',
    persisted: true,
    snapshotOnly: false,
    notes: '097C handoff lives in snapshot; merge with CursorAutomationTask on migrate.',
  },
  {
    localStorageKey: 'ai-company-events',
    entityKind: 'history_event',
    domainModule: 'events/eventStorage',
    domainType: 'CompanyEvent',
    persisted: true,
    snapshotOnly: false,
    notes: 'Company timeline; unify with run timeline in HistoryEvent table.',
  },
  {
    localStorageKey: '(none)',
    entityKind: 'memory_draft',
    domainModule: 'maxWorkerLoop/maxWorkerLoopDrafts',
    domainType: 'MemoryEvolutionDraft',
    persisted: false,
    snapshotOnly: true,
    notes: 'Built in assembleMaxWorkerLoopSnapshot — lost on refresh unless run completes evolution.',
  },
  {
    localStorageKey: '(none)',
    entityKind: 'knowledge_draft',
    domainModule: 'maxWorkerLoop/maxWorkerLoopDrafts',
    domainType: 'KnowledgeCandidateDraft',
    persisted: false,
    snapshotOnly: true,
    notes: 'Draft candidates — must persist before Owner review in production.',
  },
]

export function listSnapshotOnlyEntities(): LocalStoragePersistenceBinding[] {
  return RUNTIME_PERSISTENCE_LOCAL_STORAGE_INVENTORY.filter((item) => item.snapshotOnly)
}

export function listPersistedLocalStorageKeys(): string[] {
  return RUNTIME_PERSISTENCE_LOCAL_STORAGE_INVENTORY.filter(
    (item) => item.persisted && item.localStorageKey !== '(none)',
  ).map((item) => item.localStorageKey)
}
