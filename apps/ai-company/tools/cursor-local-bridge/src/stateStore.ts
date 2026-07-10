/**
 * Cursor Local Bridge — filesystem state store (AI-COMPANY-113E).
 */

import fs from 'node:fs'
import type { CursorBridgeConfig } from './config.ts'
import {
  CURSOR_BRIDGE_VERSION,
  type CursorBridgeHistoryEntry,
  type CursorBridgeRunRecord,
  type CursorBridgeRunStatus,
} from './types.ts'

type BridgeStateFile = {
  version: typeof CURSOR_BRIDGE_VERSION
  runs: Record<string, CursorBridgeRunRecord>
  updatedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function emptyState(): BridgeStateFile {
  return { version: CURSOR_BRIDGE_VERSION, runs: {}, updatedAt: nowIso() }
}

function ensureBridgeDir(config: CursorBridgeConfig): void {
  fs.mkdirSync(config.bridgeDir, { recursive: true })
  fs.mkdirSync(config.pendingDir, { recursive: true })
  fs.mkdirSync(config.inboxDir, { recursive: true })
  fs.mkdirSync(config.outboxDir, { recursive: true })
}

export function readBridgeState(config: CursorBridgeConfig): BridgeStateFile {
  ensureBridgeDir(config)
  try {
    const raw = fs.readFileSync(config.stateFile, 'utf8')
    const parsed = JSON.parse(raw) as BridgeStateFile
    if (parsed.version !== CURSOR_BRIDGE_VERSION || typeof parsed.runs !== 'object') {
      return emptyState()
    }
    return parsed
  } catch {
    return emptyState()
  }
}

export function writeBridgeState(config: CursorBridgeConfig, state: BridgeStateFile): void {
  ensureBridgeDir(config)
  fs.writeFileSync(
    config.stateFile,
    JSON.stringify({ ...state, updatedAt: nowIso() }, null, 2),
    'utf8',
  )
}

export function listBridgeRuns(config: CursorBridgeConfig): CursorBridgeRunRecord[] {
  return Object.values(readBridgeState(config).runs).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

export function getBridgeRun(config: CursorBridgeConfig, runId: string): CursorBridgeRunRecord | null {
  return readBridgeState(config).runs[runId] ?? null
}

export function upsertBridgeRun(
  config: CursorBridgeConfig,
  run: CursorBridgeRunRecord,
): CursorBridgeRunRecord {
  const state = readBridgeState(config)
  state.runs[run.runId] = { ...run, updatedAt: nowIso() }
  writeBridgeState(config, state)
  return state.runs[run.runId]
}

export function appendBridgeHistory(
  run: CursorBridgeRunRecord,
  message: string,
  cursorExitCode: number | null = null,
): CursorBridgeRunRecord {
  const entry: CursorBridgeHistoryEntry = {
    at: nowIso(),
    message,
    cursorExitCode,
  }
  return {
    ...run,
    history: [entry, ...run.history],
    updatedAt: nowIso(),
  }
}

export function patchBridgeRunStatus(
  config: CursorBridgeConfig,
  runId: string,
  status: CursorBridgeRunStatus,
  patch: Partial<CursorBridgeRunRecord> = {},
  historyMessage?: string,
): CursorBridgeRunRecord | null {
  const existing = getBridgeRun(config, runId)
  if (!existing) return null

  let next: CursorBridgeRunRecord = {
    ...existing,
    ...patch,
    status,
    updatedAt: nowIso(),
  }

  if (historyMessage) {
    next = appendBridgeHistory(next, historyMessage, patch.cursorOpenExitCode ?? null)
  }

  return upsertBridgeRun(config, next)
}

export function createBridgeRunRecord(input: {
  runId: string
  title: string
  employeeId: string | null
  workItemId: string | null
  companyId: string | null
  repositoryRoot: string
  inboxRelativePath: string
  outboxRelativePath: string
}): CursorBridgeRunRecord {
  const now = nowIso()
  return {
    version: CURSOR_BRIDGE_VERSION,
    runId: input.runId,
    status: 'pending',
    title: input.title,
    employeeId: input.employeeId,
    workItemId: input.workItemId,
    companyId: input.companyId,
    repositoryRoot: input.repositoryRoot,
    inboxRelativePath: input.inboxRelativePath,
    outboxRelativePath: input.outboxRelativePath,
    cursorBinary: null,
    cursorOpenExitCode: null,
    cursorOpenError: null,
    history: [],
    resultIngestedAt: null,
    result: null,
    createdAt: now,
    updatedAt: now,
  }
}
