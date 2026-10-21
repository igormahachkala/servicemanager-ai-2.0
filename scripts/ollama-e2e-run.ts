/**
 * One-off: the first LIVE end-to-end run of the ollama route. Not a test, not
 * committed. Run from apps/ai-company:
 *
 *   OLLAMA_BASE_URL=http://localhost:11434 node --import tsx ../../scripts/ollama-e2e-run.ts
 *
 * Path, exactly as production takes it:
 *   requestToolExecution(toolId:'ollama') -> ToolExecutionRun (awaiting_owner)
 *   approveToolExecutionRun               -> approved
 *   queueToolExecutionRunForOllamaAnalysis-> queued -> running -> model -> result
 *
 * Nothing is mocked except the store: the domain persists runs in localStorage,
 * which node does not have, so the same in-memory shim the unit tests use stands
 * in for it. The dispatcher, the bridge, the status machine, the HTTP call, the
 * section validator and the envelope are all the shipped code, and the model is
 * the real qwen3-coder:30b on this machine.
 */

import { EMPLOYEE_ROUTE_IDS, resolveCanonicalEmployeeId } from '../apps/ai-company/src/mission-control/data/employeeIdResolver.ts'
import { createEmployeeWorkItem } from '../apps/ai-company/src/domain/employeeWorkQueue/employeeWorkQueueStorage.ts'
import { queueToolExecutionRunForOllamaAnalysis } from '../apps/ai-company/src/domain/ollamaAnalysis/ollamaAnalysisSync.ts'
import { requestToolExecution } from '../apps/ai-company/src/domain/toolExecution/toolExecutionRunBridge.ts'
import {
  approveToolExecutionRun,
  getToolExecutionRun,
} from '../apps/ai-company/src/domain/toolExecution/toolExecutionRunStorage.ts'

function installStorageShim(): void {
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

const TASK_TITLE = 'Audit an invoice helper'
const TASK_INSTRUCTIONS = [
  'Review this function for bugs:',
  '',
  'function applyDiscount(total, percent) {',
  '  return total - percent',
  '}',
  '',
  'It is called from the checkout page to apply a percentage discount to an order total.',
].join('\n')

function line(): void {
  console.log('='.repeat(74))
}

async function main(): Promise<void> {
  installStorageShim()

  console.log(`OLLAMA_BASE_URL = ${process.env.OLLAMA_BASE_URL ?? '(unset)'}`)
  line()

  // 1. Work item, then the run through the tool-neutral entry point.
  const workItem = createEmployeeWorkItem({
    employeeId: resolveCanonicalEmployeeId(EMPLOYEE_ROUTE_IDS.builder),
    title: 'E2E work item',
    companyId: 'company-default',
  })

  const { run, dispatch } = requestToolExecution({
    workItemId: workItem.id,
    title: TASK_TITLE,
    instructions: TASK_INSTRUCTIONS,
    companyId: 'company-default',
    toolId: 'ollama',
  })

  console.log('1. requestToolExecution')
  console.log(`   run id            : ${run.id}`)
  console.log(`   run.toolId        : ${run.toolId}`)
  console.log(`   run.status        : ${run.status}`)
  console.log(`   dispatch action   : ${dispatch.request.action}`)
  console.log(`   dispatch status   : ${dispatch.result.status}`)
  console.log(`   dispatch output   : ${JSON.stringify(dispatch.result.output)}`)
  line()

  // 2. Owner approval. This also fires the detached browser trigger, which bails
  //    the moment the awaited call below moves the run out of `approved`.
  const approved = approveToolExecutionRun(run.id, 'Approved by the e2e script.')
  console.log('2. approveToolExecutionRun')
  console.log(`   run.status        : ${approved?.status}`)
  line()

  // 3. The headless executor — awaited, no fetch injection, real model.
  console.log('3. queueToolExecutionRunForOllamaAnalysis — calling the model …')
  const startedAt = Date.now()
  const outcome = await queueToolExecutionRunForOllamaAnalysis(run.id)
  const wallMs = Date.now() - startedAt

  console.log(`   outcome.ok        : ${outcome.ok}`)
  console.log(`   outcome.error     : ${outcome.error ?? 'null'}`)
  console.log(`   wall clock        : ${(wallMs / 1000).toFixed(1)}s`)
  line()

  // 4. Final state, read back out of the store.
  const final = getToolExecutionRun(run.id)
  if (!final) {
    console.error('Run vanished from the store.')
    process.exitCode = 1
    return
  }

  console.log('4. status walk (from run.history)')
  for (const entry of final.history) {
    console.log(`   ${entry.at}  ${entry.status.padEnd(24)} ${entry.message ?? ''}`)
  }
  console.log('')
  console.log(`   FINAL STATUS      : ${final.status}`)
  console.log(`   run.error         : ${final.error ?? 'null'}`)
  console.log(`   result.deliveryMode: ${final.result?.deliveryMode ?? 'n/a'}`)
  console.log(`   result.plannedOnly : ${final.result?.plannedOnly ?? 'n/a'}`)
  console.log(`   result.receivedAt  : ${final.result?.receivedAt ?? 'n/a'}`)
  line()

  const output = final.result?.output as Record<string, unknown> | undefined
  const envelope = output?.cursorResultEnvelopeV110 as Record<string, unknown> | undefined

  if (!envelope) {
    console.log('No envelope recorded on the run.')
    process.exitCode = outcome.ok ? 0 : 1
    return
  }

  const metadata = envelope.metadata as Record<string, unknown>

  console.log('5. envelope in result.output')
  console.log(`   route             : ${envelope.route}`)
  console.log(`   transportStatus   : ${envelope.transportStatus}`)
  console.log(`   executionStatus   : ${envelope.executionStatus}`)
  console.log(`   reviewStatus      : ${envelope.reviewStatus}`)
  console.log(`   toolExecutionRunId: ${envelope.toolExecutionRunId}`)
  console.log(`   metadata.transport: ${metadata.transport}`)
  console.log(`   sectionsValidated : ${metadata.sectionsValidated}`)
  console.log(`   analysisSections  : ${JSON.stringify(metadata.analysisSections)}`)
  console.log(`   analysisModel     : ${metadata.analysisModel}`)
  console.log(`   metrics           : ${JSON.stringify(metadata.analysisMetrics)}`)
  console.log(`   errors            : ${JSON.stringify(envelope.errors)}`)
  line()

  console.log('6. model answer, verbatim (envelope.summary)')
  console.log('')
  console.log(envelope.summary)
  console.log('')
  line()

  process.exitCode = outcome.ok ? 0 : 1
}

main().catch((error: unknown) => {
  console.error('')
  console.error('--- UNCAUGHT ---')
  console.error(error)
  process.exitCode = 1
})
