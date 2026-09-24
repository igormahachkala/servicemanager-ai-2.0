/**
 * Secret redaction. Applied to any text before it is written back to the
 * ServiceManager API (PATCH /agent-tasks/:id/result) and before logging.
 */

const PATTERNS: Array<{ re: RegExp; label: string }> = [
  // JWT (header.payload.signature, base64url) — e.g. eyJ...
  { re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, label: 'JWT' },
  // Anthropic API keys
  { re: /sk-ant-[A-Za-z0-9_-]{8,}/g, label: 'ANTHROPIC_KEY' },
  // Generic OpenAI-style keys
  { re: /sk-[A-Za-z0-9]{20,}/g, label: 'API_KEY' },
  // Bearer tokens in headers
  { re: /Bearer\s+[A-Za-z0-9._-]{8,}/gi, label: 'BEARER' },
  // key/value secret assignments: password=..., api_key: "...", token = '...'
  {
    re: /\b(password|passwd|secret|api[_-]?key|access[_-]?token|token)\b\s*[:=]\s*["']?[^\s"',]{4,}["']?/gi,
    label: 'SECRET',
  },
]

/**
 * Mask known secret patterns and any explicitly provided secret literals
 * (e.g. the agent password passed from config).
 */
export function redact(text: string, extraSecrets: string[] = []): string {
  if (!text) return text
  let out = text

  for (const secret of extraSecrets) {
    if (secret && secret.length >= 4) {
      out = out.split(secret).join('«REDACTED»')
    }
  }

  for (const { re, label } of PATTERNS) {
    out = out.replace(re, `«REDACTED:${label}»`)
  }

  return out
}
