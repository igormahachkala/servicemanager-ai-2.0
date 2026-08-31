/**
 * Tool Dispatcher — endpoint config via Vite env (AI-COMPANY-111B).
 * No hardcoded IP addresses in domain code.
 */

import type { ToolDispatcherEndpointRef, ToolDispatcherToolId } from './toolDispatcherTypes'

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Headless fallback. Outside Vite there is no import.meta.env and no origin, so
 * a cron job, a script or a night shift cannot name the endpoint at all.
 *
 * Read through globalThis rather than the bare `process` identifier: the app
 * compiles with types ["vite/client"] and no node types, and a browser bundle
 * has no process binding — a property lookup is safe in both worlds.
 */
function readProcessEnv(key: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  const value = env?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const RAW_IP_PATTERNS = [
  /^https?:\/\/192\.\d+\.\d+\.\d+/i,
  /^https?:\/\/83\.\d+\.\d+\.\d+/i,
  /^https?:\/\/10\.\d+\.\d+\.\d+/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i,
] as const

export function assertToolEndpointHasNoRawIp(url: string | null): void {
  if (!url) return
  for (const pattern of RAW_IP_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `Tool endpoint must not contain raw IP — use env/config or same-origin path (got blocked pattern in URL)`,
      )
    }
  }
}

function resolveRelativeBaseUrl(): string | null {
  if (typeof window === 'undefined') return null
  return window.location.origin
}

function readCursorBaseUrl(): string | null {
  const explicit =
    readEnv('VITE_TOOL_DISPATCHER_CURSOR_BASE_URL') ??
    readEnv('VITE_CURSOR_AUTOMATION_BASE_URL')

  if (explicit) {
    assertToolEndpointHasNoRawIp(explicit)
    return explicit
  }

  return resolveRelativeBaseUrl()
}

export function getToolDispatcherEndpointConfig(
  toolId: ToolDispatcherToolId,
): ToolDispatcherEndpointRef {
  if (toolId === 'cursor') {
    const baseUrl = readCursorBaseUrl()
    if (baseUrl) assertToolEndpointHasNoRawIp(baseUrl)

    return {
      configKey: 'VITE_TOOL_DISPATCHER_CURSOR_BASE_URL',
      baseUrl,
      submitPath:
        readEnv('VITE_TOOL_DISPATCHER_CURSOR_SUBMIT_PATH') ??
        '/api/v1/cursor-automation/submit',
      statusPath:
        readEnv('VITE_TOOL_DISPATCHER_CURSOR_STATUS_PATH') ??
        '/api/v1/cursor-automation/status',
    }
  }

  if (toolId === 'ollama') {
    // Two shapes, and the path prefix follows the base:
    //   same-origin (browser) -> `/runtime/ollama/*`, a prefix Vite strips before
    //                            forwarding to 127.0.0.1:11434 (vite.config.ts)
    //   explicit absolute base -> talk to Ollama directly, so no relay prefix;
    //                            keeping it would ask Ollama for /runtime/... → 404
    // The raw-IP guard applies to a configured value only: on a LAN phone the
    // origin legitimately *is* an IP (108C), and that must not throw.
    const viteBase = readEnv('VITE_TOOL_DISPATCHER_OLLAMA_BASE_URL')
    const headlessBase = viteBase ? undefined : readProcessEnv('OLLAMA_BASE_URL')
    const explicit = viteBase ?? headlessBase
    if (explicit) assertToolEndpointHasNoRawIp(explicit)

    const relayPrefix = explicit ? '' : '/runtime/ollama'

    return {
      configKey: headlessBase ? 'OLLAMA_BASE_URL' : 'VITE_TOOL_DISPATCHER_OLLAMA_BASE_URL',
      baseUrl: explicit ?? resolveRelativeBaseUrl(),
      submitPath:
        readEnv('VITE_TOOL_DISPATCHER_OLLAMA_SUBMIT_PATH') ?? `${relayPrefix}/api/generate`,
      statusPath:
        readEnv('VITE_TOOL_DISPATCHER_OLLAMA_STATUS_PATH') ?? `${relayPrefix}/api/tags`,
    }
  }

  throw new Error(`Unknown tool dispatcher id: ${toolId}`)
}

export function buildToolDispatcherEndpointUrl(
  endpoint: ToolDispatcherEndpointRef,
  path: 'submit' | 'status',
): string | null {
  const segment = path === 'submit' ? endpoint.submitPath : endpoint.statusPath
  if (!endpoint.baseUrl) return segment.startsWith('/') ? segment : `/${segment}`
  const base = endpoint.baseUrl.replace(/\/$/, '')
  const suffix = segment.startsWith('/') ? segment : `/${segment}`
  return `${base}${suffix}`
}
