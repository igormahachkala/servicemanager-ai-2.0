import { getDefaultOllamaSettingsFromEnv } from '../../../config/environment'
import { OLLAMA_DEFAULT_MODEL_TAG } from './runtimeCapabilities'
import {
  buildDefaultOllamaSettings,
  normalizeOllamaSettings,
  type OllamaSettings,
} from './ollamaSourceMode'

export const OLLAMA_SETTINGS_KEY = 'ai-company-ollama-settings'
export const RUNTIME_LOGS_KEY = 'ai-company-runtime-logs'
export const RUNTIME_HEALTH_KEY = 'ai-company-runtime-health-snapshot'

export type { OllamaSettings } from './ollamaSourceMode'

const SSR_DEFAULT_SETTINGS: OllamaSettings = buildDefaultOllamaSettings(OLLAMA_DEFAULT_MODEL_TAG)

function resolveDefaultSettings(): OllamaSettings {
  if (typeof window === 'undefined') return SSR_DEFAULT_SETTINGS
  try {
    return getDefaultOllamaSettingsFromEnv()
  } catch {
    return buildDefaultOllamaSettings(OLLAMA_DEFAULT_MODEL_TAG)
  }
}

export function loadOllamaSettings(): OllamaSettings {
  if (typeof window === 'undefined') return SSR_DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(OLLAMA_SETTINGS_KEY)
    if (!raw) return resolveDefaultSettings()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return resolveDefaultSettings()
    return normalizeOllamaSettings(parsed as Record<string, unknown>, OLLAMA_DEFAULT_MODEL_TAG)
  } catch {
    return resolveDefaultSettings()
  }
}

export function saveOllamaSettings(settings: OllamaSettings): void {
  if (typeof window === 'undefined') return
  try {
    const normalized = normalizeOllamaSettings(settings, OLLAMA_DEFAULT_MODEL_TAG)
    localStorage.setItem(OLLAMA_SETTINGS_KEY, JSON.stringify(normalized))
  } catch {
    /* noop */
  }
}

export { normalizeOllamaBaseUrl } from './ollamaSourceMode'

export type RuntimeLogLevel = 'info' | 'warn' | 'error' | 'success'

export type RuntimeLogEntry = {
  id: string
  at: string
  level: RuntimeLogLevel
  message: string
  runId: string | null
  providerId: string | null
}

export type RuntimeHealthSnapshot = {
  providerId: string
  checkedAt: string
  latencyMs: number
  loadedModels: string[]
  lastError: string | null
  lastExecutionDurationMs: number | null
  lastEstimatedTokens: number | null
}

export function estimateTokensFromText(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  options: { retries?: number; retryDelayMs?: number } = {},
): Promise<Response> {
  const retries = options.retries ?? 2
  const retryDelayMs = options.retryDelayMs ?? 600
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init)
      if (response.ok || attempt === retries) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
      if (attempt === retries) break
    }
    await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs * (attempt + 1)))
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed')
}

export function appendRuntimeLog(entry: Omit<RuntimeLogEntry, 'id' | 'at'>): RuntimeLogEntry {
  const next: RuntimeLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
  }
  const logs = [next, ...loadRuntimeLogs()].slice(0, 100)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(RUNTIME_LOGS_KEY, JSON.stringify(logs))
    } catch {
      /* noop */
    }
  }
  return next
}

export function loadRuntimeLogs(): RuntimeLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RUNTIME_LOGS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RuntimeLogEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RuntimeLogEntry).message === 'string',
    )
  } catch {
    return []
  }
}

export function clearRuntimeLogs(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RUNTIME_LOGS_KEY)
  } catch {
    /* noop */
  }
}

export function saveRuntimeHealthSnapshot(snapshot: RuntimeHealthSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RUNTIME_HEALTH_KEY, JSON.stringify(snapshot))
  } catch {
    /* noop */
  }
}

export function loadRuntimeHealthSnapshot(): RuntimeHealthSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(RUNTIME_HEALTH_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const value = parsed as RuntimeHealthSnapshot
    if (typeof value.providerId !== 'string') return null
    return value
  } catch {
    return null
  }
}

export class RuntimeExecutionMonitor {
  private startedAt = 0

  start(): void {
    this.startedAt = Date.now()
  }

  finish(): number {
    if (!this.startedAt) return 0
    return Date.now() - this.startedAt
  }

  elapsed(): number {
    if (!this.startedAt) return 0
    return Date.now() - this.startedAt
  }
}

export type RuntimeAbortReason = 'timeout' | 'cancelled'

export type RuntimeExecutionFailureReason =
  | RuntimeAbortReason
  | 'http'
  | 'network'
  | 'ollama'
  | 'unknown'

export class RuntimeExecutionError extends Error {
  readonly reason: RuntimeExecutionFailureReason
  readonly elapsedMs: number

  constructor(
    message: string,
    reason: RuntimeExecutionFailureReason,
    elapsedMs: number,
  ) {
    super(message)
    this.name = 'RuntimeExecutionError'
    this.reason = reason
    this.elapsedMs = elapsedMs
  }
}

export function createRuntimeExecutionError(
  error: unknown,
  abortReason: RuntimeAbortReason | null,
  elapsedMs: number,
  timeoutMs: number,
): RuntimeExecutionError {
  if (abortReason === 'timeout') {
    return new RuntimeExecutionError(
      `Ollama execution timed out after ${Math.round(timeoutMs / 1000)}s (${formatElapsedMs(elapsedMs)} elapsed)`,
      'timeout',
      elapsedMs,
    )
  }
  if (abortReason === 'cancelled') {
    return new RuntimeExecutionError(
      `Ollama execution cancelled by user (${formatElapsedMs(elapsedMs)} elapsed)`,
      'cancelled',
      elapsedMs,
    )
  }
  if (error instanceof Error) {
    if (/HTTP \d+/.test(error.message)) {
      return new RuntimeExecutionError(error.message, 'http', elapsedMs)
    }
    if (error.name === 'TypeError' || /fetch|network|Failed to fetch/i.test(error.message)) {
      return new RuntimeExecutionError(`Network error: ${error.message}`, 'network', elapsedMs)
    }
    return new RuntimeExecutionError(error.message, 'unknown', elapsedMs)
  }
  return new RuntimeExecutionError(String(error), 'unknown', elapsedMs)
}

export function formatElapsedMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const rem = Math.round(seconds % 60)
  return `${minutes}m ${rem}s`
}

export function formatRuntimeError(error: unknown): string {
  if (error instanceof RuntimeExecutionError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}
