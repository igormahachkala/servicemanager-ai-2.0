/**
 * Cursor Automation — secret redaction (AI-COMPANY-113).
 */

const API_KEY_PATTERN = /crsr_[A-Za-z0-9_-]{8,}/g
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._-]+/gi

export function redactCursorAutomationSecret(
  text: string,
  secret: string | null | undefined,
): string {
  let result = text
  if (secret && secret.length >= 8) {
    const head = secret.slice(0, 6)
    const tail = secret.slice(-4)
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'g'), `${head}***${tail}`)
  }
  result = result.replace(API_KEY_PATTERN, 'crsr_***REDACTED***')
  result = result.replace(BEARER_PATTERN, 'Bearer ***REDACTED***')
  return result
}

export function redactWebhookConfigForLog(input: {
  url: string | null
  apiKey: string | null
}): Record<string, string | null> {
  return {
    url: input.url ? redactCursorAutomationSecret(input.url, input.apiKey) : null,
    apiKey: input.apiKey ? '***REDACTED***' : null,
  }
}
