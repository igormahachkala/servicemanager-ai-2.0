/**
 * One-off: the full ollama path over a REAL piece of this codebase.
 * Not a test, not committed. Run from apps/ai-company:
 *
 *   OLLAMA_BASE_URL=http://localhost:11434 node --import tsx ../../scripts/ollama-e2e-real-code.ts
 *
 * The function under review is read off disk rather than pasted, so the model
 * sees the code as it is right now and the run cannot drift from the file.
 *
 * Endpoint goes straight to Ollama through OLLAMA_BASE_URL — no Vite proxy, no
 * dev server needed. Only the store is shimmed: the domain persists runs in
 * localStorage, which node does not have.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { EMPLOYEE_ROUTE_IDS, resolveCanonicalEmployeeId } from '../apps/ai-company/src/mission-control/data/employeeIdResolver.ts'
import { createEmployeeWorkItem } from '../apps/ai-company/src/domain/employeeWorkQueue/employeeWorkQueueStorage.ts'
import { queueToolExecutionRunForOllamaAnalysis } from '../apps/ai-company/src/domain/ollamaAnalysis/ollamaAnalysisSync.ts'
import { requestToolExecution } from '../apps/ai-company/src/domain/toolExecution/toolExecutionRunBridge.ts'
import {
  approveToolExecutionRun,
  getToolExecutionRun,
} from '../apps/ai-company/src/domain/toolExecution/toolExecutionRunStorage.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_FILE = resolve(
  HERE,
  '../apps/ai-company/src/domain/toolExecution/toolExecutionRunStorage.ts',
)
const FIRST_LINE = 256
const LAST_LINE = 297

function readFunctionSource(): string {
  const lines = readFileSync(SOURCE_FILE, 'utf8').split('\n')
  const slice = lines.slice(FIRST_LINE - 1, LAST_LINE)
  if (!slice[0].includes('export function approveToolExecutionRun')) {
    throw new Error(`Line ${FIRST_LINE} is no longer approveToolExecutionRun: ${slice[0]}`)
  }
  return slice.join('\n')
}

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

function line(): void {
  console.log('='.repeat(78))
}

async function main(): Promise<void> {
  installStorageShim()

  const source = readFunctionSource()
  const instructions = [
    'Review this function for a testability or safety problem in how it triggers',
    'side effects after approval.',
    '',
    `File: apps/ai-company/src/domain/toolExecution/toolExecutionRunStorage.ts:${FIRST_LINE}`,
    '',
    '```ts',
    source,
    '```',
  ].join('\n')

  console.log(`OLLAMA_BASE_URL = ${process.env.OLLAMA_BASE_URL ?? '(unset)'}`)
  console.log(`source          = toolExecutionRunStorage.ts:${FIRST_LINE}-${LAST_LINE}`)
  console.log(`source bytes    = ${source.length}`)
  line()

  const workItem = createEmployeeWorkItem({
    employeeId: resolveCanonicalEmployeeId(EMPLOYEE_ROUTE_IDS.builder),
    title: 'Audit approveToolExecutionRun',
    companyId: 'company-default',
  })

  const { run, dispatch } = requestToolExecution({
    workItemId: workItem.id,
    title: 'Audit approveToolExecutionRun side effects',
    instructions,
    companyId: 'company-default',
    toolId: 'ollama',
  })

  console.log('1. requestToolExecution')
  console.log(`   run id          : ${run.id}`)
  console.log(`   run.toolId      : ${run.toolId}`)
  console.log(`   run.status      : ${run.status}`)
  console.log(`   dispatch action : ${dispatch.request.action}`)
  console.log(`   dispatch status : ${dispatch.result.status}`)
  line()

  const approved = approveToolExecutionRun(run.id, 'Approved by the real-code e2e script.')
  console.log(`2. approveToolExecutionRun -> ${approved?.status}`)
  line()

  console.log('3. queueToolExecutionRunForOllamaAnalysis — real model, real code …')
  const startedAt = Date.now()
  const outcome = await queueToolExecutionRunForOllamaAnalysis(run.id)
  const wallMs = Date.now() - startedAt
  console.log(`   outcome.ok      : ${outcome.ok}`)
  console.log(`   outcome.error   : ${outcome.error ?? 'null'}`)
  console.log(`   wall clock      : ${(wallMs / 1000).toFixed(1)}s`)
  line()

  const final = getToolExecutionRun(run.id)
  if (!final) {
    console.error('Run vanished from the store.')
    process.exitCode = 1
    return
  }

  console.log('4. status walk')
  for (const entry of final.history) {
    console.log(`   ${entry.at}  ${entry.status.padEnd(24)} ${entry.message ?? ''}`)
  }
  console.log('')
  console.log(`   FINAL STATUS       : ${final.status}`)
  console.log(`   result.deliveryMode: ${final.result?.deliveryMode ?? 'n/a'}`)
  line()

  const output = final.result?.output as Record<string, unknown> | undefined
  const envelope = output?.cursorResultEnvelopeV110 as Record<string, unknown> | undefined
  if (!envelope) {
    console.log('No envelope recorded.')
    process.exitCode = 1
    return
  }

  const metadata = envelope.metadata as Record<string, unknown>
  console.log('5. envelope')
  console.log(`   route            : ${envelope.route}`)
  console.log(`   transportStatus  : ${envelope.transportStatus}`)
  console.log(`   executionStatus  : ${envelope.executionStatus}`)
  console.log(`   reviewStatus     : ${envelope.reviewStatus}`)
  console.log(`   sectionsValidated: ${metadata.sectionsValidated}`)
  console.log(`   analysisSections : ${JSON.stringify(metadata.analysisSections)}`)
  console.log(`   analysisModel    : ${metadata.analysisModel}`)
  console.log(`   metrics          : ${JSON.stringify(metadata.analysisMetrics)}`)
  console.log(`   errors           : ${JSON.stringify(envelope.errors)}`)
  line()

  console.log('6. model answer, verbatim')
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
