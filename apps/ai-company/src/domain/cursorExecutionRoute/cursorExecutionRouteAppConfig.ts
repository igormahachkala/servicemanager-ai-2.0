/**
 * Cursor route policy — Vite/browser runtime config (AI-COMPANY-109F).
 * Env reads live here, not in domain mapper.
 */

import { defaultExpectedCostByRoute } from './cursorExecutionRoutePolicy'
import type {
  CursorExecutionEnvironment,
  CursorRoutePolicyDispatchConfig,
} from './cursorExecutionRouteTypes'

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readViteEnvironment(): CursorExecutionEnvironment {
  const raw = readEnv('VITE_AI_COMPANY_ENVIRONMENT')?.toLowerCase()
  if (raw === 'stage' || raw === 'production') return raw
  return 'dev'
}

function readAutomationWebhookAvailable(): boolean {
  const raw = readEnv('VITE_CURSOR_AUTOMATION_WEBHOOK_AVAILABLE')?.toLowerCase()
  return raw === 'true' || raw === '1'
}

export function resolveCursorRoutePolicyDispatchConfig(
  partial?: Partial<CursorRoutePolicyDispatchConfig>,
): CursorRoutePolicyDispatchConfig {
  const environment = partial?.environment ?? readViteEnvironment()
  return {
    environment,
    automationWebhookAvailable:
      partial?.automationWebhookAvailable ?? readAutomationWebhookAvailable(),
    localBridgeAvailable:
      partial?.localBridgeAvailable ?? (environment === 'dev' || environment === 'stage'),
    manualOperatorAvailable: partial?.manualOperatorAvailable ?? true,
    expectedCostClassificationByRoute:
      partial?.expectedCostClassificationByRoute ?? defaultExpectedCostByRoute(),
  }
}
