/**
 * Configuration for agent-runner.
 *
 * Source of truth is the process environment ONLY. This module never reads any
 * .env file (neither its own nor the project's) and never touches the
 * filesystem — satisfying the "do not read project .env / repo files" rule.
 *
 * Execution backend: a LOCAL Ollama model (no external AI API keys).
 */

export type RunMode = 'dry-run' | 'live'

export interface Config {
  mode: RunMode
  once: boolean
  apiBaseUrl: string
  agentEmail: string
  agentPassword: string
  ollamaBaseUrl: string
  ollamaModel: string
  pollIntervalMs: number
  taskTimeoutMs: number
  // V1 code-aware context. codeRoot empty => prompt-only (MVP) behaviour.
  codeRoot: string
  maxContextFiles: number
  maxFileBytes: number
  maxContextBytes: number
  // Project Intelligence infrastructure (caches live under agent-runner/.cache/).
  projectIndexPath: string
  fileSummaryCachePath: string
  enableSummaryCache: boolean
  enableModuleProfiles: boolean
  // Reserved capability for the FUTURE write-mode IMPLEMENT (SMA-AI-001). Default
  // off. IMPLEMENT_DRY_RUN (SMA-AI-002) is always safe and ignores this flag — it
  // never writes files, creates branches, pushes, or opens PRs.
  enableImplement: boolean
}

export interface LoadResult {
  config: Config
  missing: string[]
  baseUrlAllowed: boolean
  baseUrlReason: string
}

/**
 * Hosts the runner is allowed to talk to for the SMA API. Defaults cover local
 * dev and the stage backend only. PRODUCTION hosts are intentionally absent, so
 * the runner refuses to start against prod unless an operator explicitly extends
 * the allowlist via ALLOWED_API_HOSTS (which should never include prod).
 */
const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '194.67.101.37']

/** Hosts that are always rejected, even if added to the allowlist by mistake. */
const PRODUCTION_DENYLIST = ['servicemanagerai.ru', 'servicemanager.ai', 'www.servicemanagerai.ru']

function num(envValue: string | undefined, fallback: number): number {
  const n = Number(envValue)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function bool(envValue: string | undefined, fallback: boolean): boolean {
  if (envValue === undefined || envValue.trim() === '') return fallback
  return !/^(0|false|no|off)$/i.test(envValue.trim())
}

function allowedHosts(): string[] {
  const extra = (process.env.ALLOWED_API_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...extra])]
}

/** Validate that the SMA base URL points at an allowed, non-production host. */
export function checkBaseUrl(baseUrl: string): { allowed: boolean; reason: string } {
  if (!baseUrl) return { allowed: false, reason: 'SMA_API_BASE_URL is not set' }
  let host: string
  try {
    host = new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return { allowed: false, reason: `SMA_API_BASE_URL is not a valid URL: ${baseUrl}` }
  }
  if (PRODUCTION_DENYLIST.some((deny) => host === deny || host.endsWith('.' + deny))) {
    return { allowed: false, reason: `host "${host}" is on the production denylist — refused` }
  }
  if (!allowedHosts().includes(host)) {
    return {
      allowed: false,
      reason: `host "${host}" is not in the allowlist (${allowedHosts().join(', ')})`,
    }
  }
  return { allowed: true, reason: `host "${host}" allowed` }
}

export function loadConfig(argv: string[]): LoadResult {
  // Safe default: dry-run. Live execution requires an explicit --live flag so
  // the worker can never start mutating tasks by accident.
  const mode: RunMode = argv.includes('--live') ? 'live' : 'dry-run'
  const once = argv.includes('--once')

  const apiBaseUrl = (process.env.SMA_API_BASE_URL || '').trim()
  const agentEmail = (process.env.SMA_AGENT_EMAIL || '').trim()
  const agentPassword = process.env.SMA_AGENT_PASSWORD || ''

  const config: Config = {
    mode,
    once,
    apiBaseUrl,
    agentEmail,
    agentPassword,
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || 'http://172.17.0.1:11434').trim(),
    ollamaModel: (process.env.OLLAMA_MODEL || 'qwen3.6:27b').trim(),
    pollIntervalMs: num(process.env.POLL_INTERVAL_MS, 15000),
    taskTimeoutMs: num(process.env.TASK_TIMEOUT_MS, 120000),
    codeRoot: (process.env.CODE_ROOT || '').trim(),
    maxContextFiles: num(process.env.MAX_CONTEXT_FILES, 20),
    maxFileBytes: num(process.env.MAX_FILE_BYTES, 12000),
    maxContextBytes: num(process.env.MAX_CONTEXT_BYTES, 80000),
    projectIndexPath: (process.env.PROJECT_INDEX_PATH || '.cache/project-index.json').trim(),
    fileSummaryCachePath: (process.env.FILE_SUMMARY_CACHE_PATH || '.cache/file-summaries.json').trim(),
    enableSummaryCache: bool(process.env.ENABLE_SUMMARY_CACHE, true),
    enableModuleProfiles: bool(process.env.ENABLE_MODULE_PROFILES, true),
    enableImplement: bool(process.env.ENABLE_IMPLEMENT, false),
  }

  const missing: string[] = []
  if (!apiBaseUrl) missing.push('SMA_API_BASE_URL')
  if (!agentEmail) missing.push('SMA_AGENT_EMAIL')
  if (!agentPassword) missing.push('SMA_AGENT_PASSWORD')
  if (!config.ollamaBaseUrl) missing.push('OLLAMA_BASE_URL')
  if (!config.ollamaModel) missing.push('OLLAMA_MODEL')

  const { allowed, reason } = checkBaseUrl(apiBaseUrl)

  return { config, missing, baseUrlAllowed: allowed, baseUrlReason: reason }
}

/** Secret literals to mask anywhere they could leak (no external AI key now). */
export function secretValues(config: Config): string[] {
  return [config.agentPassword].filter(Boolean)
}
