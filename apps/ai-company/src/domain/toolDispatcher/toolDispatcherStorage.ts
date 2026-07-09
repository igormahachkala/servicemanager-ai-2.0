/**
 * Tool Dispatcher — localStorage for requests/results (AI-COMPANY-111B).
 */

import {
  TOOL_DISPATCHER_VERSION,
  type ToolDispatcherToolId,
  type ToolRequest,
  type ToolResult,
} from './toolDispatcherTypes'

export const TOOL_DISPATCHER_STORAGE_KEY = 'ai-company-tool-dispatcher'

export const TOOL_DISPATCHER_SYNC_EVENT = 'ai-company-tool-dispatcher-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(TOOL_DISPATCHER_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type ToolDispatcherStorageSnapshot = {
  version: typeof TOOL_DISPATCHER_VERSION
  requests: ToolRequest[]
  results: ToolResult[]
  updatedAt: string
}

function emptySnapshot(): ToolDispatcherStorageSnapshot {
  return {
    version: TOOL_DISPATCHER_VERSION,
    requests: [],
    results: [],
    updatedAt: nowIso(),
  }
}

function readSnapshot(): ToolDispatcherStorageSnapshot {
  if (typeof window === 'undefined') return emptySnapshot()
  try {
    const raw = window.localStorage.getItem(TOOL_DISPATCHER_STORAGE_KEY)
    if (!raw) return emptySnapshot()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== TOOL_DISPATCHER_VERSION) return emptySnapshot()
    return {
      version: TOOL_DISPATCHER_VERSION,
      requests: Array.isArray(parsed.requests) ? (parsed.requests as ToolRequest[]) : [],
      results: Array.isArray(parsed.results) ? (parsed.results as ToolResult[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
    }
  } catch {
    return emptySnapshot()
  }
}

function writeSnapshot(snapshot: ToolDispatcherStorageSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    TOOL_DISPATCHER_STORAGE_KEY,
    JSON.stringify({ ...snapshot, updatedAt: nowIso() }),
  )
  emitSync()
}

export function createToolDispatcherRequestId(): string {
  return createId('td-req')
}

export function loadToolDispatcherRequests(): ToolRequest[] {
  return readSnapshot().requests
}

export function loadToolDispatcherResults(): ToolResult[] {
  return readSnapshot().results
}

export function getToolDispatcherRequestById(requestId: string): ToolRequest | null {
  return loadToolDispatcherRequests().find((item) => item.requestId === requestId) ?? null
}

export function getToolDispatcherResultByRequestId(requestId: string): ToolResult | null {
  return loadToolDispatcherResults().find((item) => item.requestId === requestId) ?? null
}

export function upsertToolDispatcherRequest(request: ToolRequest): ToolRequest {
  const snapshot = readSnapshot()
  const index = snapshot.requests.findIndex((item) => item.requestId === request.requestId)
  if (index >= 0) snapshot.requests[index] = request
  else snapshot.requests.unshift(request)
  writeSnapshot(snapshot)
  return request
}

export function upsertToolDispatcherResult(result: ToolResult): ToolResult {
  const snapshot = readSnapshot()
  const index = snapshot.results.findIndex((item) => item.requestId === result.requestId)
  if (index >= 0) snapshot.results[index] = result
  else snapshot.results.unshift(result)
  writeSnapshot(snapshot)
  return result
}

export function listToolDispatcherResultsForTool(toolId: ToolDispatcherToolId): ToolResult[] {
  return loadToolDispatcherResults().filter((item) => item.toolId === toolId)
}
