/**
 * Cursor Local Bridge — browser client (localhost only, AI-COMPANY-113E).
 */

import {
  CURSOR_BRIDGE_DEFAULT_HOST,
  CURSOR_BRIDGE_DEFAULT_PORT,
  type CursorBridgeClientOutcome,
  type CursorBridgeEnqueuePayload,
  type CursorBridgeRunSnapshot,
} from './cursorLocalBridgeTypes'

function resolveBridgeBaseUrl(): string {
  const host =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CURSOR_BRIDGE_HOST
      ? String(import.meta.env.VITE_CURSOR_BRIDGE_HOST)
      : CURSOR_BRIDGE_DEFAULT_HOST
  const port =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CURSOR_BRIDGE_PORT
      ? String(import.meta.env.VITE_CURSOR_BRIDGE_PORT)
      : String(CURSOR_BRIDGE_DEFAULT_PORT)
  return `http://${host}:${port}`
}

async function bridgeFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    const response = await fetch(`${resolveBridgeBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    return response
  } catch {
    return null
  }
}

function parseRun(value: unknown): CursorBridgeRunSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.runId !== 'string' || typeof record.status !== 'string') return null
  return record as unknown as CursorBridgeRunSnapshot
}

export async function probeCursorLocalBridge(): Promise<boolean> {
  const response = await bridgeFetch('/v1/health')
  if (!response?.ok) return false
  return true
}

export async function enqueueCursorLocalBridgeRun(
  payload: CursorBridgeEnqueuePayload,
): Promise<CursorBridgeClientOutcome> {
  const response = await bridgeFetch('/v1/runs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response) {
    return {
      ok: false,
      bridgeOnline: false,
      run: null,
      error: 'Cursor Local Bridge is offline — run npm --prefix apps/ai-company run cursor:bridge',
    }
  }

  if (!response.ok) {
    let error = `Bridge enqueue failed (${response.status}).`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) error = body.error
    } catch {
      // ignore
    }
    return { ok: false, bridgeOnline: true, run: null, error }
  }

  const body = (await response.json()) as { run?: unknown }
  const run = parseRun(body.run)
  return {
    ok: Boolean(run),
    bridgeOnline: true,
    run,
    error: run ? null : 'Bridge returned invalid run payload.',
  }
}

export async function fetchCursorLocalBridgeRuns(): Promise<CursorBridgeRunSnapshot[]> {
  const response = await bridgeFetch('/v1/runs')
  if (!response?.ok) return []
  const body = (await response.json()) as { runs?: unknown[] }
  if (!Array.isArray(body.runs)) return []
  return body.runs.map(parseRun).filter((item): item is CursorBridgeRunSnapshot => item !== null)
}

export async function fetchCursorLocalBridgeRun(
  runId: string,
): Promise<CursorBridgeRunSnapshot | null> {
  const response = await bridgeFetch(`/v1/runs/${encodeURIComponent(runId)}`)
  if (!response?.ok) return null
  const body = (await response.json()) as { run?: unknown }
  return parseRun(body.run)
}
