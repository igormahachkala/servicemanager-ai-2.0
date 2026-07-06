/**
 * Cursor Automation Service Adapter — mock implementation (AI-COMPANY-099B).
 * Simulates submit → running → pr_opened without HTTP or credentials.
 */

import { upsertCursorAutomationRun } from './cursorAutomationStorage'
import type { CursorAutomationTask } from './cursorAutomation'
import {
  buildNormalizedAutomationResult,
  extractPrFromRawPayload,
  normalizeRawPrPayload,
} from './cursorAutomationServiceAdapterMappers'
import type {
  CursorAutomationAdapterRunRecord,
  CursorAutomationAdapterRunStatus,
  CursorAutomationCancelResult,
  CursorAutomationIngestAdapterInput,
  CursorAutomationIngestAdapterResult,
  CursorAutomationServiceAdapter,
  CursorAutomationStatusResult,
  CursorAutomationAdapterSubmitResult,
  CursorAutomationSubmitInput,
} from './cursorAutomationServiceAdapterTypes'
import {
  CURSOR_AUTOMATION_ADAPTER_CONTRACT_VERSION,
  canCancelAdapterRun,
  isTerminalAdapterRunStatus,
} from './cursorAutomationServiceAdapterTypes'
import {
  mapPrToRuntimeReportPatch,
  mapResultToCursorRulesCandidates,
  mapResultToMemoryEvolutionHints,
} from './cursorAutomationServiceAdapterMappers'

const STORAGE_KEY = 'ai-company-cursor-automation-adapter-runs'

export const CURSOR_AUTOMATION_ADAPTER_MOCK_SYNC_EVENT = 'ai-company-cursor-automation-adapter-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function createAdapterRunId(): string {
  return `cursor-adapter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createExternalRunId(): string {
  return `cursor-ext-mock-${Math.random().toString(36).slice(2, 10)}`
}

function createMockPrUrl(task: CursorAutomationTask): string {
  const slug = task.repository.branch.replace(/[^a-z0-9-]/gi, '-').slice(0, 32)
  return `https://github.com/${task.repository.owner}/${task.repository.repo}/pull/mock-${slug}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAdapterRun(value: unknown): CursorAutomationAdapterRunRecord | null {
  if (!isRecord(value)) return null
  if (typeof value.adapterRunId !== 'string' || typeof value.localTaskId !== 'string') return null
  return value as CursorAutomationAdapterRunRecord
}

function loadAdapterRuns(): CursorAutomationAdapterRunRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseAdapterRun).filter((item): item is CursorAutomationAdapterRunRecord => item !== null)
  } catch {
    return []
  }
}

function saveAdapterRuns(runs: CursorAutomationAdapterRunRecord[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
  window.dispatchEvent(new Event(CURSOR_AUTOMATION_ADAPTER_MOCK_SYNC_EVENT))
}

function upsertAdapterRun(run: CursorAutomationAdapterRunRecord): CursorAutomationAdapterRunRecord {
  const runs = loadAdapterRuns()
  const index = runs.findIndex((item) => item.adapterRunId === run.adapterRunId)
  if (index >= 0) {
    runs[index] = run
  } else {
    runs.unshift(run)
  }
  saveAdapterRuns(runs)
  return run
}

function getAdapterRunById(adapterRunId: string): CursorAutomationAdapterRunRecord | null {
  return loadAdapterRuns().find((item) => item.adapterRunId === adapterRunId) ?? null
}

function advanceMockStatus(run: CursorAutomationAdapterRunRecord): CursorAutomationAdapterRunRecord {
  if (isTerminalAdapterRunStatus(run.status)) return run

  const nextPoll = run.pollCount + 1
  let status: CursorAutomationAdapterRunStatus = run.status

  if (run.status === 'submitted' && nextPoll >= 1) status = 'running'
  if (run.status === 'running' && nextPoll >= 2) status = 'pr_opened'
  if (run.status === 'submitted' && nextPoll >= 2) status = 'pr_opened'

  const now = nowIso()
  const prUrl = status === 'pr_opened' || status === 'completed' ? run.prUrl : null

  return upsertAdapterRun({
    ...run,
    status,
    pollCount: nextPoll,
    prUrl,
    prTitle: prUrl ? run.prTitle : run.prTitle,
    buildStatus: status === 'pr_opened' ? 'pending' : run.buildStatus,
    updatedAt: now,
  })
}

function toStatusResult(run: CursorAutomationAdapterRunRecord): CursorAutomationStatusResult {
  const prSummary =
    run.prUrl != null
      ? normalizeRawPrPayload({
          number: run.prNumber,
          url: run.prUrl,
          title: run.prTitle,
          changedFiles: 0,
          checksStatus: run.buildStatus === 'passing' ? 'passing' : run.buildStatus === 'failing' ? 'failing' : 'pending',
          reviewRequested: true,
        })
      : null

  return {
    adapterRunId: run.adapterRunId,
    localTaskId: run.localTaskId,
    status: run.status,
    externalRunId: run.externalRunId,
    prSummary,
    buildStatus: run.buildStatus,
    updatedAt: run.updatedAt,
    error: run.errorMessage,
  }
}

function validateSubmitInput(input: CursorAutomationSubmitInput): string | null {
  if (!input.task.id.trim()) return 'task.id обязателен'
  if (!input.promptMarkdown.trim()) return 'promptMarkdown пуст — handoff не готов'
  if (input.ownerApprovalStatus === 'rejected') {
    return 'Owner Approval отклонён — submit запрещён'
  }
  if (input.task.requiresOwnerApproval && input.ownerApprovalStatus !== 'approved') {
    return 'Требуется одобрение Owner перед submit'
  }
  return null
}

export function createCursorAutomationServiceAdapterMock(): CursorAutomationServiceAdapter {
  return {
    adapterKind: 'mock_v1',
    contractVersion: CURSOR_AUTOMATION_ADAPTER_CONTRACT_VERSION,

    async submitAutomationTask(input: CursorAutomationSubmitInput): Promise<CursorAutomationAdapterSubmitResult> {
      const validationError = validateSubmitInput(input)
      if (validationError) {
        return {
          ok: false,
          adapterRunId: null,
          localTaskId: input.task.id,
          status: 'failed',
          externalRunId: null,
          error: validationError,
        }
      }

      const now = nowIso()
      const externalRunId = createExternalRunId()
      const prUrl = createMockPrUrl(input.task)

      const run: CursorAutomationAdapterRunRecord = {
        adapterRunId: createAdapterRunId(),
        localTaskId: input.task.id,
        companyId: input.companyId,
        workspaceId: input.workspaceId,
        maxWorkerLoopId: input.task.maxWorkerLoopId,
        runtimeRunId: input.task.runtimeRunId,
        handoffId: input.handoff?.handoffId ?? null,
        ownerApprovalId: input.ownerApprovalId,
        status: 'submitted',
        promptMarkdown: input.promptMarkdown,
        externalRunId,
        prUrl,
        prTitle: input.task.title,
        prNumber: null,
        buildStatus: 'unknown',
        pollCount: 0,
        submittedAt: now,
        completedAt: null,
        cancelledAt: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      }

      upsertAdapterRun(run)
      upsertCursorAutomationRun({
        ...input.task,
        status: 'running',
        updatedAt: now,
      })

      return {
        ok: true,
        adapterRunId: run.adapterRunId,
        localTaskId: input.task.id,
        status: 'submitted',
        externalRunId,
        error: null,
      }
    },

    async getAutomationStatus(adapterRunId: string): Promise<CursorAutomationStatusResult | null> {
      const existing = getAdapterRunById(adapterRunId)
      if (!existing) return null

      const advanced = advanceMockStatus(existing)
      return toStatusResult(advanced)
    },

    async cancelAutomationRun(adapterRunId: string): Promise<CursorAutomationCancelResult> {
      const run = getAdapterRunById(adapterRunId)
      if (!run) {
        return { ok: false, adapterRunId, status: 'failed', error: 'Adapter run not found' }
      }

      if (!canCancelAdapterRun(run.status)) {
        return {
          ok: false,
          adapterRunId,
          status: run.status,
          error: `Cancel недоступен для status=${run.status}`,
        }
      }

      const now = nowIso()
      upsertAdapterRun({
        ...run,
        status: 'cancelled',
        cancelledAt: now,
        updatedAt: now,
        errorMessage: 'Cancelled by Owner (mock adapter).',
      })

      return { ok: true, adapterRunId, status: 'cancelled', error: null }
    },

    async ingestAutomationResult(
      input: CursorAutomationIngestAdapterInput,
    ): Promise<CursorAutomationIngestAdapterResult> {
      const run = getAdapterRunById(input.adapterRunId)
      if (!run) {
        return {
          ok: false,
          adapterRunId: input.adapterRunId,
          status: 'failed',
          normalized: null,
          error: 'Adapter run not found',
        }
      }

      if (run.status === 'cancelled') {
        return {
          ok: false,
          adapterRunId: input.adapterRunId,
          status: 'cancelled',
          normalized: null,
          error: 'Run cancelled — ingestion skipped',
        }
      }

      const finishedAt = nowIso()
      const prFromRaw = extractPrFromRawPayload(input.raw)
      const pr =
        prFromRaw ??
        normalizeRawPrPayload({
          number: run.prNumber,
          url: run.prUrl,
          title: run.prTitle,
          changedFiles: 0,
          checksStatus: 'pending',
          reviewRequested: true,
        })

      const rawError =
        input.raw != null && isRecord(input.raw) && typeof input.raw.error === 'string'
          ? input.raw.error
          : null

      const normalized = buildNormalizedAutomationResult({
        task: input.task,
        pr,
        raw: input.raw,
        knowledgeCandidates: input.knowledgeCandidates,
        finishedAt,
        errorMessage: rawError,
      })

      upsertAdapterRun({
        ...run,
        status: rawError ? 'failed' : 'completed',
        prUrl: pr?.url ?? run.prUrl,
        prTitle: pr?.title ?? run.prTitle,
        prNumber: pr?.number ?? run.prNumber,
        buildStatus: pr?.checksStatus === 'passing' ? 'passing' : pr?.checksStatus === 'failing' ? 'failing' : 'pending',
        completedAt: finishedAt,
        updatedAt: finishedAt,
        errorMessage: rawError,
      })

      upsertCursorAutomationRun({
        ...input.task,
        status: rawError ? 'failed' : 'completed',
        updatedAt: finishedAt,
      })

      return {
        ok: !rawError,
        adapterRunId: input.adapterRunId,
        status: rawError ? 'failed' : 'completed',
        normalized,
        error: rawError,
      }
    },

    mapPrToRuntimeReportPatch: mapPrToRuntimeReportPatch,
    mapResultToMemoryEvolutionHints: mapResultToMemoryEvolutionHints,
    mapResultToCursorRulesCandidates: mapResultToCursorRulesCandidates,
  }
}

/** Singleton mock adapter for dev — swap via factory when cursor_api_v1 lands. */
let defaultMockAdapter: CursorAutomationServiceAdapter | null = null

export function getCursorAutomationServiceAdapterMock(): CursorAutomationServiceAdapter {
  if (!defaultMockAdapter) {
    defaultMockAdapter = createCursorAutomationServiceAdapterMock()
  }
  return defaultMockAdapter
}

export function resetCursorAutomationServiceAdapterMockForTests(): void {
  defaultMockAdapter = null
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function getCursorAutomationAdapterRunById(
  adapterRunId: string,
): CursorAutomationAdapterRunRecord | null {
  return getAdapterRunById(adapterRunId)
}

export function listCursorAutomationAdapterRuns(): CursorAutomationAdapterRunRecord[] {
  return loadAdapterRuns()
}

export function markCursorAutomationAdapterRunReady(
  localTaskId: string,
  params: {
    companyId: string
    workspaceId: string | null
    promptMarkdown: string
    maxWorkerLoopId?: string | null
    runtimeRunId?: string | null
    handoffId?: string | null
    ownerApprovalId?: string | null
  },
): CursorAutomationAdapterRunRecord {
  const now = nowIso()
  const existing = loadAdapterRuns().find((item) => item.localTaskId === localTaskId)

  if (existing && existing.status !== 'draft') {
    return existing
  }

  const run: CursorAutomationAdapterRunRecord = {
    adapterRunId: existing?.adapterRunId ?? createAdapterRunId(),
    localTaskId,
    companyId: params.companyId,
    workspaceId: params.workspaceId,
    maxWorkerLoopId: params.maxWorkerLoopId ?? null,
    runtimeRunId: params.runtimeRunId ?? null,
    handoffId: params.handoffId ?? null,
    ownerApprovalId: params.ownerApprovalId ?? null,
    status: 'ready_to_submit',
    promptMarkdown: params.promptMarkdown,
    externalRunId: null,
    prUrl: null,
    prTitle: null,
    prNumber: null,
    buildStatus: 'unknown',
    pollCount: 0,
    submittedAt: null,
    completedAt: null,
    cancelledAt: null,
    errorMessage: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  return upsertAdapterRun(run)
}
