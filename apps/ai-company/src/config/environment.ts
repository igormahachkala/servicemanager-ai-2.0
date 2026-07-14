/**
 * AI Company environment config — build-time defaults via Vite VITE_* vars.
 *
 * Priority at runtime (first Ollama load, before Owner UI override):
 *   1. localStorage ai-company-ollama-settings (Owner UI)
 *   2. VITE_* env baked into bundle at build
 *   3. window.location.hostname → prod_server on 83.166.245.27
 *   4. localhost http://127.0.0.1:11434 (or /runtime/ollama relay when browser is LAN/remote)
 *
 * Mac = development. 83.166.245.27 = target production runtime.
 * See docs/ai-company/AI-COMPANY-094A-environment-strategy.md
 */

import {
  inferDeployEnvironmentFromHost,
  normalizeOllamaSettings,
  type OllamaDeployEnvironment,
  type OllamaEndpointMode,
  type OllamaSettings,
} from '../domain/runtime/providers/ollamaSourceMode'
import { OLLAMA_DEFAULT_MODEL_TAG } from '../domain/runtime/providers/runtimeCapabilities'
import type { RuntimeProviderId } from '../domain/runtime/providers/runtimeProvider'
import { isRuntimeProviderId } from '../domain/runtime/providers/providerRegistry'

export type AiCompanyEnvironment = 'development' | 'production'

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** development on Mac; production on 83.166.245.27 after DNS cutover. */
export function getAiCompanyEnvironment(): AiCompanyEnvironment {
  const raw = readEnv('VITE_AI_COMPANY_ENV')
  if (raw === 'production') return 'production'
  if (typeof window !== 'undefined' && inferDeployEnvironmentFromHost() === 'prod_server') {
    return 'production'
  }
  return 'development'
}

export function isProductionEnvironment(): boolean {
  return getAiCompanyEnvironment() === 'production'
}

export function isDevelopmentEnvironment(): boolean {
  return getAiCompanyEnvironment() === 'development'
}

function readDeployEnvironment(): OllamaDeployEnvironment | undefined {
  const raw =
    readEnv('VITE_AI_COMPANY_DEPLOY_ENV') ?? readEnv('VITE_AI_COMPANY_DEPLOY_ENVIRONMENT')
  if (raw === 'dev_mac' || raw === 'prod_server') return raw
  if (getAiCompanyEnvironment() === 'production') return 'prod_server'
  if (typeof window !== 'undefined') {
    return inferDeployEnvironmentFromHost()
  }
  return undefined
}

function readEndpointMode(): OllamaEndpointMode | undefined {
  const raw = readEnv('VITE_AI_COMPANY_OLLAMA_ENDPOINT_MODE')
  if (raw === 'localhost' || raw === 'custom') return raw
  return undefined
}

/** Default Ollama settings when localStorage has no saved Owner preferences. */
export function getDefaultOllamaSettingsFromEnv(): OllamaSettings {
  const baseUrl = readEnv('VITE_AI_COMPANY_OLLAMA_BASE_URL')
  const defaultModelTag = readEnv('VITE_AI_COMPANY_OLLAMA_DEFAULT_MODEL')

  return normalizeOllamaSettings(
    {
      deployEnvironment: readDeployEnvironment(),
      endpointMode: readEndpointMode(),
      baseUrl,
      defaultModelTag,
    },
    defaultModelTag ?? OLLAMA_DEFAULT_MODEL_TAG,
  )
}

/** Default runtime provider id when localStorage has no active provider. */
export function getDefaultRuntimeProviderFromEnv(): RuntimeProviderId {
  const raw = readEnv('VITE_AI_COMPANY_RUNTIME_PROVIDER')
  if (raw && isRuntimeProviderId(raw)) return raw
  return 'ollama'
}
