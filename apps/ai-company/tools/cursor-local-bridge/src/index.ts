#!/usr/bin/env node
/**
 * Cursor Local Bridge — CLI entry (AI-COMPANY-113E).
 *
 * Commands:
 *   run     — start daemon (localhost + outbox watcher)
 *   status  — print bridge status snapshot
 *   enqueue — write pending/<runId>.json from stdin or flags (manual QA)
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  CURSOR_LOCAL_INBOX_RELATIVE,
  CURSOR_LOCAL_OUTBOX_RELATIVE,
  getCursorBridgeConfig,
} from './config.ts'
import { startOutboxWatcher } from './outboxWatcher.ts'
import { processPendingDirectory } from './queueProcessor.ts'
import { printBridgeStatus, startBridgeServer } from './server.ts'
import { CURSOR_BRIDGE_VERSION } from './types.ts'

async function runDaemon(): Promise<void> {
  const config = getCursorBridgeConfig()
  const startedAt = new Date().toISOString()

  console.log(`[cursor-bridge] AI Company Cursor Local Bridge ${CURSOR_BRIDGE_VERSION}`)
  console.log(`[cursor-bridge] repository: ${config.repositoryRoot}`)
  console.log(`[cursor-bridge] inbox: ${CURSOR_LOCAL_INBOX_RELATIVE}/<runId>/`)
  console.log(`[cursor-bridge] outbox: ${CURSOR_LOCAL_OUTBOX_RELATIVE}/<runId>/result.json`)
  console.log(`[cursor-bridge] listening: http://${config.host}:${config.port}`)

  const pendingProcessed = await processPendingDirectory(config)
  if (pendingProcessed > 0) {
    console.log(`[cursor-bridge] processed ${pendingProcessed} pending request(s).`)
  }

  const outboxWatcher = startOutboxWatcher(config, (outcome) => {
    console.log(
      `[cursor-bridge] result ingested: ${outcome.runId} (${outcome.result.status}) → ${outcome.ingestedPath}`,
    )
  })

  const server = await startBridgeServer(config, startedAt)

  const shutdown = async (): Promise<void> => {
    console.log('\n[cursor-bridge] shutting down…')
    outboxWatcher.stop()
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown()
  })
  process.on('SIGTERM', () => {
    void shutdown()
  })
}

function runStatus(): void {
  const config = getCursorBridgeConfig()
  printBridgeStatus(config)
}

function runEnqueueFromArgs(args: string[]): void {
  const config = getCursorBridgeConfig()
  const runIdFlag = args.find((item) => item.startsWith('--run-id='))
  const runId = runIdFlag?.slice('--run-id='.length).trim()
  if (!runId) {
    console.error('Usage: enqueue --run-id=<id> [--file=pending.json]')
    process.exit(1)
  }

  const fileFlag = args.find((item) => item.startsWith('--file='))
  const filePath = fileFlag?.slice('--file='.length)

  let payload: unknown
  if (filePath) {
    payload = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'))
  } else {
    console.error('Provide --file=pending.json with enqueue request body.')
    process.exit(1)
  }

  fs.mkdirSync(config.pendingDir, { recursive: true })
  const target = path.join(config.pendingDir, `${runId}.json`)
  fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`[cursor-bridge] pending request written: ${target}`)
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run'

  switch (command) {
    case 'run':
      await runDaemon()
      break
    case 'status':
      runStatus()
      break
    case 'enqueue':
      runEnqueueFromArgs(process.argv.slice(3))
      break
    default:
      console.error(`Unknown command: ${command}. Use run | status | enqueue`)
      process.exit(1)
  }
}

main().catch((error) => {
  console.error('[cursor-bridge] fatal:', error instanceof Error ? error.message : error)
  process.exit(1)
})
