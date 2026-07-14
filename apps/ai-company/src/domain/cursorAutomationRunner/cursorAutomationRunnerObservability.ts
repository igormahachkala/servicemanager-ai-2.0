/**
 * Cursor Automation Runner — observability events (AI-COMPANY-113).
 */

import type {
  CursorAutomationRunnerEvent,
  CursorAutomationRunnerEventType,
  CursorAutomationRunnerReasonCode,
} from './cursorAutomationRunnerTypes'
import { redactCursorAutomationSecret } from './cursorAutomationSecretRedaction'

function nowIso(): string {
  return new Date().toISOString()
}

export function createCursorAutomationRunnerEvent(
  type: CursorAutomationRunnerEventType,
  toolExecutionRunId: string,
  reasonCode: CursorAutomationRunnerReasonCode | string,
  metadata?: Record<string, unknown>,
  secret?: string | null,
): CursorAutomationRunnerEvent {
  const safeMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          key,
          typeof value === 'string' ? redactCursorAutomationSecret(value, secret) : value,
        ]),
      )
    : undefined

  return {
    type,
    at: nowIso(),
    toolExecutionRunId,
    reasonCode,
    metadata: safeMetadata,
  }
}

export function formatCursorAutomationRunnerEvent(event: CursorAutomationRunnerEvent): string {
  return `[cursor-automation:${event.type}] run=${event.toolExecutionRunId} reason=${event.reasonCode}`
}
