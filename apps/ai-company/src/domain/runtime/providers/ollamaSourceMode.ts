/**
 * Ollama endpoint strategy — DEV Mac и PROD server (83.166.245.27).
 *
 * И DEV, и PROD по умолчанию используют http://127.0.0.1:11434:
 * - Mac: локальный `ollama serve`
 * - PROD server: Ollama на том же хосте, порт 11434 закрыт снаружи
 *
 * Custom URL — только временный обход (SSH-туннель / dev → remote), не публичный :11434.
 */

/** Целевой production host AI Company после DNS cutover. */
export const AI_COMPANY_PRODUCTION_HOST = '83.166.245.27'

/** Единственный рекомендуемый endpoint — localhost на машине, где крутится Runtime. */
export const OLLAMA_LOCALHOST_ENDPOINT = 'http://127.0.0.1:11434'

/** @deprecated alias — используйте OLLAMA_LOCALHOST_ENDPOINT */
export const OLLAMA_LOCAL_MAC_BASE_URL = OLLAMA_LOCALHOST_ENDPOINT

const OLLAMA_LOCALHOST_ALIAS = 'http://localhost:11434'

/** Где развёрнут UI AI Company — не путать с Ollama URL. */
export type OllamaDeployEnvironment = 'dev_mac' | 'prod_server'

/** Как Runtime достигает Ollama. */
export type OllamaEndpointMode = 'localhost' | 'custom'

export type OllamaSettings = {
  baseUrl: string
  defaultModelTag: string
  deployEnvironment: OllamaDeployEnvironment
  endpointMode: OllamaEndpointMode
}

/** Legacy external URLs — мигрируются в custom, не показываются как preset в UI. */
const LEGACY_EXTERNAL_OLLAMA_URLS = [
  'http://194.67.92.12:11434',
  'http://83.166.245.27:11434',
] as const

export function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '')
}

function isLocalhostEndpoint(baseUrl: string): boolean {
  const normalized = normalizeOllamaBaseUrl(baseUrl).toLowerCase()
  return (
    normalized === OLLAMA_LOCALHOST_ENDPOINT.toLowerCase() ||
    normalized === OLLAMA_LOCALHOST_ALIAS.toLowerCase()
  )
}

export function inferDeployEnvironmentFromHost(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
): OllamaDeployEnvironment {
  const host = hostname.trim().toLowerCase()
  if (host === AI_COMPANY_PRODUCTION_HOST) return 'prod_server'
  return 'dev_mac'
}

function isLegacyExternalUrl(baseUrl: string): boolean {
  const normalized = normalizeOllamaBaseUrl(baseUrl).toLowerCase()
  return LEGACY_EXTERNAL_OLLAMA_URLS.some((item) => item.toLowerCase() === normalized)
}

function migrateLegacySourceMode(raw: Record<string, unknown>): OllamaEndpointMode | null {
  const legacy = raw.sourceMode
  if (legacy === 'local_mac') return 'localhost'
  if (legacy === 'vps' || legacy === 'custom') return 'custom'
  return null
}

export function inferEndpointMode(baseUrl: string): OllamaEndpointMode {
  if (isLocalhostEndpoint(baseUrl)) return 'localhost'
  return 'custom'
}

export function resolveOllamaBaseUrl(settings: {
  endpointMode: OllamaEndpointMode
  baseUrl: string
}): string {
  if (settings.endpointMode === 'localhost') {
    return OLLAMA_LOCALHOST_ENDPOINT
  }
  return normalizeOllamaBaseUrl(settings.baseUrl) || OLLAMA_LOCALHOST_ENDPOINT
}

export function buildDefaultOllamaSettings(defaultModelTag: string): OllamaSettings {
  return normalizeOllamaSettings(
    {
      deployEnvironment: inferDeployEnvironmentFromHost(),
      endpointMode: 'localhost',
      baseUrl: OLLAMA_LOCALHOST_ENDPOINT,
      defaultModelTag,
    },
    defaultModelTag,
  )
}

export function normalizeOllamaSettings(
  raw: {
    baseUrl?: unknown
    defaultModelTag?: unknown
    deployEnvironment?: unknown
    endpointMode?: unknown
    /** @deprecated migrated from 094B v1 */
    sourceMode?: unknown
    /** @deprecated migrated from 094B v1 */
    vpsPresetId?: unknown
  },
  fallbackDefaultModelTag: string,
): OllamaSettings {
  const rawBaseUrl =
    typeof raw.baseUrl === 'string' && raw.baseUrl.trim()
      ? normalizeOllamaBaseUrl(raw.baseUrl)
      : OLLAMA_LOCALHOST_ENDPOINT

  const defaultModelTag =
    typeof raw.defaultModelTag === 'string' && raw.defaultModelTag.trim()
      ? raw.defaultModelTag.trim()
      : fallbackDefaultModelTag

  let deployEnvironment: OllamaDeployEnvironment
  if (raw.deployEnvironment === 'dev_mac' || raw.deployEnvironment === 'prod_server') {
    deployEnvironment = raw.deployEnvironment
  } else {
    deployEnvironment = inferDeployEnvironmentFromHost()
  }

  let endpointMode: OllamaEndpointMode
  const legacyMode =
    typeof raw === 'object' && raw !== null
      ? migrateLegacySourceMode(raw as Record<string, unknown>)
      : null

  if (raw.endpointMode === 'localhost' || raw.endpointMode === 'custom') {
    endpointMode = raw.endpointMode
  } else if (legacyMode) {
    endpointMode = legacyMode
  } else if (isLegacyExternalUrl(rawBaseUrl)) {
    endpointMode = 'custom'
  } else {
    endpointMode = inferEndpointMode(rawBaseUrl)
  }

  const baseUrl = resolveOllamaBaseUrl({ endpointMode, baseUrl: rawBaseUrl })

  return {
    baseUrl,
    defaultModelTag,
    deployEnvironment,
    endpointMode,
  }
}
