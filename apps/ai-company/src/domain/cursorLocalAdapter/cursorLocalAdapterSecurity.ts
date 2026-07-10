/**
 * Cursor Local Adapter — payload security (AI-COMPANY-113C).
 */

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /https?:\/\/192\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?[^\s)'"]*/gi, label: 'private-ip' },
  { pattern: /https?:\/\/83\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?[^\s)'"]*/gi, label: 'server-ip' },
  { pattern: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?[^\s)'"]*/gi, label: 'ipv4-url' },
  { pattern: /\b(?:api[_-]?key|secret|password|token|bearer)\s*[:=]\s*\S+/gi, label: 'credential' },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi, label: 'private-key' },
  { pattern: /\.env(?:\.[a-z0-9_-]+)?\b/gi, label: 'dotenv' },
]

export type CursorLocalSecurityViolation = {
  label: string
  match: string
}

export function scanCursorLocalSecurityViolations(text: string): CursorLocalSecurityViolation[] {
  const violations: CursorLocalSecurityViolation[] = []
  for (const rule of FORBIDDEN_PATTERNS) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      violations.push({ label: rule.label, match: match[0].slice(0, 120) })
      if (!rule.pattern.global) break
    }
  }
  return violations
}

export function sanitizeCursorLocalText(text: string): string {
  let result = text
  for (const rule of FORBIDDEN_PATTERNS) {
    result = result.replace(rule.pattern, `[removed-${rule.label}]`)
  }
  return result
}

export function assertCursorLocalPayloadSafe(parts: Record<string, string>): void {
  const violations = Object.entries(parts).flatMap(([field, value]) =>
    scanCursorLocalSecurityViolations(value).map((item) => ({ field, ...item })),
  )
  if (violations.length === 0) return
  const summary = violations
    .slice(0, 3)
    .map((item) => `${item.field}: ${item.label}`)
    .join('; ')
  throw new Error(`Cursor local payload blocked (${summary}).`)
}
