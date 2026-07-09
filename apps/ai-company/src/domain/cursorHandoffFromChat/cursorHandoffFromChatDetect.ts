/**
 * Detect Owner intent to hand off work to Cursor (110C).
 */

const CURSOR_HANDOFF_INTENT_PATTERNS: RegExp[] = [
  /сделай\s+в\s+cursor/i,
  /передай\s+в\s+cursor/i,
  /пусть\s+cursor\s+исправ/i,
  /подготовь\s+задачу\s+для\s+cursor/i,
  /hand\s*off\s+to\s+cursor/i,
  /pass\s+to\s+cursor/i,
  /send\s+to\s+cursor/i,
  /cursor\s+handoff/i,
  /prepare\s+(a\s+)?task\s+for\s+cursor/i,
]

export function detectCursorHandoffIntent(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  return CURSOR_HANDOFF_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))
}

/** Strip forbidden URL patterns from handoff markdown (No IP rule). */
export function sanitizeCursorHandoffText(text: string): string {
  return text
    .replace(/https?:\/\/192\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?[^\s)']*/gi, '[removed-private-ip]')
    .replace(/https?:\/\/83\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?[^\s)']*/gi, '[removed-server-ip]')
    .replace(/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:11434[^\s)']*/gi, '[removed-ollama-ip]')
}

export function assertHandoffMarkdownSafe(markdown: string): void {
  if (/https?:\/\/192\./i.test(markdown)) {
    throw new Error('Handoff markdown must not contain http://192.* URLs')
  }
  if (/https?:\/\/83\./i.test(markdown)) {
    throw new Error('Handoff markdown must not contain http://83.* URLs')
  }
}
