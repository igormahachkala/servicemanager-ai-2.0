/**
 * Runtime Persistence V1 — port contracts (AI-COMPANY-098B).
 *
 * Реализации:
 * - V0 (current): browser localStorage via *Storage.ts — НЕ implements эти порты
 * - V1 (target): NestJS API + Prisma repositories
 * - V1.5 (bridge): LocalStoragePersistenceAdapter implements ports for offline dev
 */

import type {
  PersistenceListQuery,
  PersistenceWriteResult,
  RuntimePersistenceEntityKind,
} from './runtimePersistenceCommon'
import type {
  CursorAutomationRunPersistenceRecord,
  HistoryEventPersistenceRecord,
  KnowledgeDraftPersistenceRecord,
  MemoryDraftPersistenceRecord,
  OwnerApprovalPersistenceRecord,
  ReportPersistenceRecord,
  RuntimeRunPersistenceRecord,
  ToolInvocationPersistenceRecord,
  WorkerLoopPersistenceRecord,
} from './runtimePersistenceEntities'

export type RuntimePersistencePortMode = 'localStorage' | 'server_api' | 'hybrid'

/** CRUD contract для одного aggregate root. */
export type RuntimePersistenceEntityPort<TRecord> = {
  getById(id: string): Promise<TRecord | null>
  list(query: PersistenceListQuery): Promise<TRecord[]>
  upsert(record: TRecord): Promise<PersistenceWriteResult<TRecord>>
  /** HistoryEvent — append-only; delete только для GDPR/admin */
  delete?(id: string): Promise<PersistenceWriteResult<null>>
}

export type RuntimeRunPersistencePort = RuntimePersistenceEntityPort<RuntimeRunPersistenceRecord> & {
  getByReportId(reportId: string): Promise<RuntimeRunPersistenceRecord | null>
}

export type WorkerLoopPersistencePort = RuntimePersistenceEntityPort<WorkerLoopPersistenceRecord> & {
  getByRuntimeRunId(runtimeRunId: string): Promise<WorkerLoopPersistenceRecord | null>
}

export type ToolInvocationPersistencePort =
  RuntimePersistenceEntityPort<ToolInvocationPersistenceRecord> & {
    listByWorkerLoopId(workerLoopId: string): Promise<ToolInvocationPersistenceRecord[]>
  }

export type OwnerApprovalPersistencePort =
  RuntimePersistenceEntityPort<OwnerApprovalPersistenceRecord> & {
    listPending(companyId: string): Promise<OwnerApprovalPersistenceRecord[]>
    decide(
      id: string,
      decision: 'approved' | 'rejected',
      note: string | null,
    ): Promise<PersistenceWriteResult<OwnerApprovalPersistenceRecord>>
  }

export type MemoryDraftPersistencePort = RuntimePersistenceEntityPort<MemoryDraftPersistenceRecord> & {
  getByRuntimeRunId(runtimeRunId: string): Promise<MemoryDraftPersistenceRecord | null>
}

export type KnowledgeDraftPersistencePort =
  RuntimePersistenceEntityPort<KnowledgeDraftPersistenceRecord> & {
    listByRuntimeRunId(runtimeRunId: string): Promise<KnowledgeDraftPersistenceRecord[]>
  }

export type CursorAutomationRunPersistencePort =
  RuntimePersistenceEntityPort<CursorAutomationRunPersistenceRecord> & {
    getByWorkerLoopId(workerLoopId: string): Promise<CursorAutomationRunPersistenceRecord | null>
  }

export type ReportPersistencePort = RuntimePersistenceEntityPort<ReportPersistenceRecord> & {
  getByRuntimeRunId(runtimeRunId: string): Promise<ReportPersistenceRecord | null>
}

export type HistoryEventPersistencePort = {
  append(event: HistoryEventPersistenceRecord): Promise<PersistenceWriteResult<HistoryEventPersistenceRecord>>
  list(query: PersistenceListQuery): Promise<HistoryEventPersistenceRecord[]>
  listBySubject(
    entity: RuntimePersistenceEntityKind,
    id: string,
  ): Promise<HistoryEventPersistenceRecord[]>
}

/** Facade — единая точка входа для backend module. */
export type RuntimePersistencePort = {
  mode: RuntimePersistencePortMode
  runtimeRuns: RuntimeRunPersistencePort
  workerLoops: WorkerLoopPersistencePort
  toolInvocations: ToolInvocationPersistencePort
  ownerApprovals: OwnerApprovalPersistencePort
  memoryDrafts: MemoryDraftPersistencePort
  knowledgeDrafts: KnowledgeDraftPersistencePort
  cursorAutomationRuns: CursorAutomationRunPersistencePort
  reports: ReportPersistencePort
  historyEvents: HistoryEventPersistencePort
}
