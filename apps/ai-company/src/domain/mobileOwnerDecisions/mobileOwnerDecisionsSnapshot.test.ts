/**
 * Owner decisions snapshot — which builder runs reach the Owner (ollama UI
 * block 2).
 *
 * The point of these cases is the pair of rules that used to be one filter on
 * `builderToolDecisionId`: cursor still needs a decision it can resolve, ollama
 * needs none, and no other tool is let in by accident.
 *
 * `fetch` is replaced for the whole file. Approving an ollama run makes
 * `approveToolExecutionRun` fire `queueToolExecutionRunForOllamaAnalysis`
 * detached and without a `fetchImpl`, and unlike the cursor branch it carries no
 * `typeof window` guard — with a live fetch this file would talk to a real
 * model on the next tick.
 */

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import {
  BUILDER_TOOL_DECISION_VERSION,
  upsertBuilderToolDecision,
  type BuilderToolDecision,
} from '../builderToolDecision/index.ts'
import { DEFAULT_COMPANY_ID } from '../company/company.ts'
import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry.ts'
import {
  isOwnerVisibleBuilderRun,
  requiresBuilderToolDecision,
} from '../toolExecution/builderToolVisibility.ts'
import {
  createToolExecutionRun,
  getToolExecutionRun,
} from '../toolExecution/toolExecutionRunStorage.ts'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes.ts'
import {
  approveMobileOwnerDecision,
  buildMobileOwnerDecisionsSnapshot,
  type MobileOwnerDecisionItem,
} from './mobileOwnerDecisionsSnapshot.ts'

function installStorageMock(): void {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }

  ;(globalThis as { window?: Window; localStorage?: Storage }).window = {
    localStorage: storage as Storage,
    dispatchEvent: () => true,
    location: { origin: 'http://localhost:5174' },
  } as unknown as Window
  ;(globalThis as { localStorage?: Storage }).localStorage = storage as Storage
}

const WORK_ITEM_ID = 'wi-owner-decisions-test'

let requestSeq = 0

function createRun(input: {
  toolId: string
  builderToolDecisionId?: string | null
  instructions?: string
  expectedResult?: string | null
  fileScope?: string[]
  checks?: string[]
}): ToolExecutionRun {
  requestSeq += 1
  return createToolExecutionRun({
    companyId: DEFAULT_COMPANY_ID,
    employeeId: BUILDER_EMPLOYEE_ID,
    toolId: input.toolId,
    toolRequestId: `treq-${requestSeq}`,
    workItemId: WORK_ITEM_ID,
    builderToolDecisionId: input.builderToolDecisionId ?? null,
    title: `Задача ${input.toolId} ${requestSeq}`,
    instructions: input.instructions ?? 'Разобрать функцию и найти баг.',
    expectedResult: input.expectedResult ?? null,
    fileScope: input.fileScope ?? [],
    checks: input.checks ?? [],
    initialStatus: 'awaiting_owner',
  })
}

function createDecision(id: string): BuilderToolDecision {
  const now = new Date('2026-09-01T10:00:00.000Z').toISOString()
  return upsertBuilderToolDecision({
    id,
    version: BUILDER_TOOL_DECISION_VERSION,
    employeeId: BUILDER_EMPLOYEE_ID,
    workItemId: WORK_ITEM_ID,
    workerLoopId: 'loop-owner-decisions-test',
    decisionPlanId: null,
    outcome: 'code_change_cursor',
    toolRequired: true,
    recommendedToolId: 'cursor',
    reason: 'Требуется правка кода — Cursor.',
    risk: 'medium',
    fileScope: ['src/domain/example.ts'],
    expectedResult: 'Сборка и тесты зелёные.',
    checks: ['npm run build'],
    confidence: 0.82,
    createdAt: now,
    updatedAt: now,
  })
}

function findItem(runId: string): MobileOwnerDecisionItem | undefined {
  return buildMobileOwnerDecisionsSnapshot().find((item) => item.toolExecutionRunId === runId)
}

let originalFetch: typeof fetch | undefined

before(() => {
  installStorageMock()
  originalFetch = globalThis.fetch
  globalThis.fetch = (() => {
    throw new Error('Network is disabled in mobileOwnerDecisionsSnapshot.test.ts')
  }) as typeof fetch
})

after(() => {
  if (originalFetch) globalThis.fetch = originalFetch
})

beforeEach(() => {
  localStorage.clear()
})

describe('builder tool visibility', () => {
  it('names cursor as decision-backed and ollama as decision-free', () => {
    assert.equal(requiresBuilderToolDecision('cursor'), true)
    assert.equal(requiresBuilderToolDecision('ollama'), false)
  })

  it('admits a cursor run only with a linked decision', () => {
    const linked = createRun({ toolId: 'cursor', builderToolDecisionId: 'btd-1' })
    const unlinked = createRun({ toolId: 'cursor' })

    assert.equal(isOwnerVisibleBuilderRun(linked), true)
    assert.equal(isOwnerVisibleBuilderRun(unlinked), false)
  })

  it('admits an ollama run without a decision and still rejects an unknown tool', () => {
    assert.equal(isOwnerVisibleBuilderRun(createRun({ toolId: 'ollama' })), true)
    assert.equal(isOwnerVisibleBuilderRun(createRun({ toolId: 'claude' })), false)
  })
})

describe('mobile owner decisions — builder tool requests', () => {
  it('keeps a cursor run with a resolvable decision unchanged', () => {
    const decision = createDecision('btd-cursor-ok')
    const run = createRun({ toolId: 'cursor', builderToolDecisionId: decision.id })

    const item = findItem(run.id)
    assert.ok(item, 'cursor run with a decision must reach the Owner')
    assert.equal(item.kind, 'builder_tool_request')
    assert.equal(item.reason, decision.reason)
    assert.equal(item.risk, 'Средний риск')
    assert.equal(item.builderTool?.toolLabel, 'Cursor')
    assert.equal(item.builderTool?.risk, 'medium')
    assert.deepEqual(item.builderTool?.fileScope, decision.fileScope)
    assert.deepEqual(item.builderTool?.checks, decision.checks)
    assert.equal(item.builderTool?.expectedResult, decision.expectedResult)
    assert.equal(item.canApprove, true)
  })

  it('hides a cursor run whose decision no longer resolves', () => {
    const run = createRun({ toolId: 'cursor', builderToolDecisionId: 'btd-missing' })

    assert.equal(findItem(run.id), undefined)
  })

  it('hides a cursor run created without a decision', () => {
    const run = createRun({ toolId: 'cursor' })

    assert.equal(findItem(run.id), undefined)
  })

  it('shows an ollama run and builds its meta from the run itself', () => {
    const run = createRun({
      toolId: 'ollama',
      instructions: 'Найди баг в applyDiscount.',
      fileScope: ['src/billing/applyDiscount.ts'],
      checks: ['npm run test:domain'],
    })

    const item = findItem(run.id)
    assert.ok(item, 'ollama run must reach the Owner without a decision')
    assert.equal(item.kind, 'builder_tool_request')
    assert.equal(item.reason, 'Найди баг в applyDiscount.')
    assert.equal(item.risk, 'Локальный анализ — без записи в репозиторий')
    assert.equal(item.builderTool?.toolLabel, 'Ollama (local)')
    assert.equal(item.builderTool?.risk, 'low')
    assert.equal(item.builderTool?.confidenceLabel, '—')
    assert.deepEqual(item.builderTool?.fileScope, ['src/billing/applyDiscount.ts'])
    assert.deepEqual(item.builderTool?.checks, ['npm run test:domain'])
    assert.equal(
      item.builderTool?.expectedResult,
      'Секции анализа: Problem / Risk / Recommendation / Effort',
    )
    assert.equal(item.canApprove, true)
    assert.equal(item.canReject, true)
  })

  it('keeps the run expectedResult when the request carried one', () => {
    const run = createRun({ toolId: 'ollama', expectedResult: 'Краткий разбор в четыре секции.' })

    assert.equal(findItem(run.id)?.builderTool?.expectedResult, 'Краткий разбор в четыре секции.')
  })

  it('hides a decision-free-looking run of a tool that is not registered as such', () => {
    const run = createRun({ toolId: 'claude' })

    assert.equal(findItem(run.id), undefined)
  })

  it('approves an ollama run through the untouched approveToolExecutionRun', () => {
    const run = createRun({ toolId: 'ollama' })
    const item = findItem(run.id)
    assert.ok(item)

    assert.equal(approveMobileOwnerDecision(item), true)
    assert.equal(getToolExecutionRun(run.id)?.status, 'approved')
  })
})
