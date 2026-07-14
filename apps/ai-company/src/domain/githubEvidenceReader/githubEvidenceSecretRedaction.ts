/**
 * GitHub Evidence Reader — secret redaction (AI-COMPANY-114).
 */

const TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
]

export function redactGitHubSecret(text: string): string {
  let result = text
  for (const pattern of TOKEN_PATTERNS) {
    result = result.replace(pattern, '***REDACTED***')
  }
  return result
}
