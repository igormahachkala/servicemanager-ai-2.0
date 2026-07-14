/**
 * Cursor Automation Webhook — runtime config (AI-COMPANY-113).
 * Secrets read from env only — never stored in git or UI.
 */

import type { CursorAutomationWebhookConfig } from './cursorAutomationRunnerTypes'

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export const CURSOR_AUTOMATION_WEBHOOK_URL_ENV_KEYS = [
  'VITE_CURSOR_AUTOMATION_WEBHOOK_URL',
  'CURSOR_AUTOMATION_WEBHOOK_URL',
] as const

export const CURSOR_AUTOMATION_WEBHOOK_API_KEY_ENV_KEYS = [
  'VITE_CURSOR_AUTOMATION_WEBHOOK_API_KEY',
  'CURSOR_AUTOMATION_WEBHOOK_API_KEY',
] as const

function readFirstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = readEnv(key)
    if (value) return value
  }
  return undefined
}

export function resolveCursorAutomationWebhookConfig(
  override?: Partial<Pick<CursorAutomationWebhookConfig, 'url' | 'apiKey'>>,
): CursorAutomationWebhookConfig {
  return {
    url: override?.url ?? readFirstEnv(CURSOR_AUTOMATION_WEBHOOK_URL_ENV_KEYS) ?? null,
    apiKey: override?.apiKey ?? readFirstEnv(CURSOR_AUTOMATION_WEBHOOK_API_KEY_ENV_KEYS) ?? null,
    configKeys: {
      url: CURSOR_AUTOMATION_WEBHOOK_URL_ENV_KEYS[0],
      apiKey: CURSOR_AUTOMATION_WEBHOOK_API_KEY_ENV_KEYS[0],
    },
  }
}

export function isCursorAutomationWebhookConfigured(
  config: CursorAutomationWebhookConfig = resolveCursorAutomationWebhookConfig(),
): boolean {
  return Boolean(config.url?.trim() && config.apiKey?.trim())
}
