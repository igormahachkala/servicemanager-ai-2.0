import {
  AI_COMPANY_PRODUCTION_HOST,
  inferDeployEnvironmentFromHost,
  OLLAMA_LOCALHOST_ENDPOINT,
  resolveEffectiveOllamaBaseUrl,
  type OllamaDeployEnvironment,
} from '../runtime/providers/ollamaSourceMode'
import { loadOllamaSettings } from '../runtime/providers/runtimeHealth'

/** Целевой production host AI Company Runtime (после DNS cutover). */
export const MAX_WORKER_PRODUCTION_HOST = AI_COMPANY_PRODUCTION_HOST

/**
 * Runtime assumptions for MAX Worker Loop — одинаковый контракт в dev и prod,
 * различается только хост UI и источник Ollama endpoint.
 */
export type MaxWorkerRuntimeEnvironment = {
  deployEnvironment: OllamaDeployEnvironment
  /** Resolved Ollama URL used by Runtime provider. */
  ollamaBaseUrl: string
  /** Browser hostname or server IP serving the SPA. */
  uiHost: string
  /** True when UI is served from production server. */
  isProductionServer: boolean
  /** Human-readable note for logs / reports. */
  assumptionNote: string
}

export function resolveMaxWorkerRuntimeEnvironment(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
): MaxWorkerRuntimeEnvironment {
  const deployEnvironment = inferDeployEnvironmentFromHost(hostname)
  const settings = loadOllamaSettings()
  const isProductionServer = deployEnvironment === 'prod_server'

  const assumptionNote = isProductionServer
    ? 'Production: MAX и Ollama на одном хосте (83.166.245.27); Ollama только localhost:11434.'
    : 'Development: MAX на Mac; Ollama — localhost, LAN relay (/runtime/ollama) или custom endpoint.'

  return {
    deployEnvironment,
    ollamaBaseUrl: resolveEffectiveOllamaBaseUrl(settings) || OLLAMA_LOCALHOST_ENDPOINT,
    uiHost: hostname || 'unknown',
    isProductionServer,
    assumptionNote,
  }
}
