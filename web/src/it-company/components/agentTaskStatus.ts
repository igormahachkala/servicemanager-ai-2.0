import type { AgentTaskStatus } from '../../lib/api'

/**
 * Shared presentation helpers for AgentTask status across IT Company pages.
 * Status *labels* differ by context (plural stat captions vs singular tags), so
 * they stay local to each page; the color map and date formatter are identical
 * and live here.
 */
export const AGENT_TASK_STATUS_COLOR: Record<AgentTaskStatus, string> = {
  NEW: '#2563eb',
  IN_PROGRESS: '#d97706',
  DONE: '#16a34a',
  FAILED: '#dc2626',
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}
