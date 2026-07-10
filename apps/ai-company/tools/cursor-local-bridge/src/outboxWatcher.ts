/**
 * Cursor Local Bridge — outbox watcher + result ingest (AI-COMPANY-113E).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { CursorBridgeConfig } from './config.ts'
import { readAndValidateResultFile } from './resultSchema.ts'
import { appendBridgeHistory, getBridgeRun, upsertBridgeRun } from './stateStore.ts'
import type { CursorLocalResultJson } from './types.ts'

export type IngestOutcome = {
  runId: string
  result: CursorLocalResultJson
  ingestedPath: string
}

export function ingestOutboxResult(
  config: CursorBridgeConfig,
  runId: string,
): IngestOutcome | null {
  const resultPath = path.join(config.outboxDir, runId, 'result.json')
  if (!fs.existsSync(resultPath)) return null

  const run = getBridgeRun(config, runId)
  if (!run) return null
  if (run.status === 'result_received') return null

  const result = readAndValidateResultFile(resultPath, runId)
  const ingestedDir = path.join(config.bridgeDir, 'ingested')
  fs.mkdirSync(ingestedDir, { recursive: true })
  const ingestedPath = path.join(ingestedDir, `${runId}.json`)
  fs.writeFileSync(ingestedPath, JSON.stringify(result, null, 2), 'utf8')

  let next = appendBridgeHistory(
    run,
    `Result ingested from outbox (status: ${result.status}).`,
    null,
  )
  next = {
    ...next,
    status: 'result_received',
    resultIngestedAt: new Date().toISOString(),
    result,
  }
  upsertBridgeRun(config, next)

  return { runId, result, ingestedPath }
}

export function scanOutboxForResults(config: CursorBridgeConfig): IngestOutcome[] {
  if (!fs.existsSync(config.outboxDir)) return []

  const outcomes: IngestOutcome[] = []
  for (const entry of fs.readdirSync(config.outboxDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const outcome = ingestOutboxResult(config, entry.name)
    if (outcome) outcomes.push(outcome)
  }
  return outcomes
}

export type OutboxWatcher = {
  stop: () => void
}

export function startOutboxWatcher(
  config: CursorBridgeConfig,
  onIngest: (outcome: IngestOutcome) => void,
  intervalMs = 2000,
): OutboxWatcher {
  fs.mkdirSync(config.outboxDir, { recursive: true })

  const tick = (): void => {
    for (const outcome of scanOutboxForResults(config)) {
      onIngest(outcome)
    }
  }

  tick()
  const timer = setInterval(tick, intervalMs)

  let watcher: fs.FSWatcher | null = null
  try {
    watcher = fs.watch(config.outboxDir, { recursive: true }, () => {
      tick()
    })
  } catch {
    // interval polling remains
  }

  return {
    stop: () => {
      clearInterval(timer)
      watcher?.close()
    },
  }
}
