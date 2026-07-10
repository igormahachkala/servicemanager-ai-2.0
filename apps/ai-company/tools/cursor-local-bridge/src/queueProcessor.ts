/**
 * Cursor Local Bridge — process approved runs → inbox + optional Cursor open (AI-COMPANY-113E).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { CursorBridgeConfig } from './config.ts'
import { detectCursorBinary } from './cursorDetect.ts'
import { openTaskInCursor } from './cursorOpen.ts'
import { writeInboxEnvelope } from './envelope.ts'
import { assertPayloadSafe } from './security.ts'
import {
  appendBridgeHistory,
  createBridgeRunRecord,
  getBridgeRun,
  upsertBridgeRun,
} from './stateStore.ts'
import type { CursorBridgeEnqueueRequest, CursorBridgeRunRecord } from './types.ts'

function validateEnqueueRequest(request: CursorBridgeEnqueueRequest): void {
  assertPayloadSafe(
    {
      title: request.title,
      instructions: request.instructions,
      expectedResult: request.expectedResult ?? '',
      fileScope: JSON.stringify(request.fileScope ?? []),
      checks: JSON.stringify(request.checks ?? []),
    },
    'Enqueue request',
  )
}

export async function processEnqueueRequest(
  config: CursorBridgeConfig,
  request: CursorBridgeEnqueueRequest,
): Promise<CursorBridgeRunRecord> {
  validateEnqueueRequest(request)

  const runId = request.runId.trim()
  const existing = getBridgeRun(config, runId)
  if (existing && existing.status !== 'failed' && existing.status !== 'pending') {
    return existing
  }

  const inbox = writeInboxEnvelope(config, request)
  const detection = detectCursorBinary()

  let run = createBridgeRunRecord({
    runId,
    title: request.title.trim(),
    employeeId: request.employeeId ?? null,
    workItemId: request.workItemId ?? null,
    companyId: request.companyId ?? null,
    repositoryRoot: config.repositoryRoot,
    inboxRelativePath: inbox.inboxRelativePath,
    outboxRelativePath: inbox.outboxRelativePath,
  })

  run = appendBridgeHistory(run, 'Task package written to cursor-inbox.', null)
  run = { ...run, status: 'queued', cursorBinary: detection.path }
  run = upsertBridgeRun(config, run)

  const taskFilePath = path.join(inbox.inboxAbsolutePath, 'task.md')
  const workspacePath = request.workspaceRelativePath
    ? path.join(config.repositoryRoot, request.workspaceRelativePath)
    : config.repositoryRoot

  if (!detection.path) {
    run = appendBridgeHistory(
      run,
      'Cursor CLI not detected — inbox package ready; open task.md manually in Cursor.',
      null,
    )
    return upsertBridgeRun(config, run)
  }

  const openOutcome = await openTaskInCursor({
    cursorBinary: detection.path,
    taskFilePath,
    workspacePath,
  })

  run = {
    ...run,
    status: openOutcome.ok ? 'opened' : 'queued',
    cursorOpenExitCode: openOutcome.exitCode,
    cursorOpenError: openOutcome.ok ? null : openOutcome.stderr || 'Cursor open failed.',
  }

  if (openOutcome.ok) {
    run = appendBridgeHistory(
      run,
      'Task package opened in Cursor; execution requires active Cursor session.',
      openOutcome.exitCode,
    )
  } else {
    run = appendBridgeHistory(
      run,
      `Cursor open attempted (exit ${openOutcome.exitCode}) — complete work manually in Cursor.`,
      openOutcome.exitCode,
    )
  }

  return upsertBridgeRun(config, run)
}

export function loadPendingRequests(config: CursorBridgeConfig): CursorBridgeEnqueueRequest[] {
  if (!fs.existsSync(config.pendingDir)) return []

  return fs
    .readdirSync(config.pendingDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try {
        const raw = fs.readFileSync(path.join(config.pendingDir, name), 'utf8')
        return JSON.parse(raw) as CursorBridgeEnqueueRequest
      } catch {
        return null
      }
    })
    .filter((item): item is CursorBridgeEnqueueRequest => item !== null && Boolean(item.runId))
}

export async function processPendingDirectory(config: CursorBridgeConfig): Promise<number> {
  const pending = loadPendingRequests(config)
  let processed = 0

  for (const request of pending) {
    await processEnqueueRequest(config, request)
    const pendingFile = path.join(config.pendingDir, `${request.runId}.json`)
    if (fs.existsSync(pendingFile)) {
      fs.renameSync(pendingFile, path.join(config.pendingDir, `${request.runId}.processed.json`))
    }
    processed += 1
  }

  return processed
}
