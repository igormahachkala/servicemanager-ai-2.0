/**
 * Employee Connections Center — secret redaction (AI-COMPANY-115).
 */

const SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bcrsr_[A-Za-z0-9_]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
]

export function redactConnectionSecret(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '***REDACTED***')
  }
  return result
}

export function maskSecretValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 4) return '••••'
  return `••••••••${trimmed.slice(-4)}`
}

export function sanitizeConnectionConfiguration(
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(configuration)) {
    if (/secret|token|password|apikey|api_key|bearer/i.test(key)) continue
    if (typeof value === 'string') {
      sanitized[key] = redactConnectionSecret(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}
