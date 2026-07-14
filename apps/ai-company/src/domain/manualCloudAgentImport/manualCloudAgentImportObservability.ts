/**
 * Manual Cloud Agent import — observability events (AI-COMPANY-111).
 */

import type {
  ManualCloudAgentImportEvent,
  ManualCloudAgentImportEventType,
  ManualCloudAgentImportFinalStatus,
  ManualCloudAgentImportReasonCode,
} from './manualCloudAgentImportTypes'

function nowIso(): string {
  return new Date().toISOString()
}

export function createManualCloudAgentImportEvent(
  type: ManualCloudAgentImportEventType,
  toolExecutionRunId: string,
  reasonCode: ManualCloudAgentImportReasonCode,
  finalStatus: ManualCloudAgentImportFinalStatus | null = null,
): ManualCloudAgentImportEvent {
  return {
    type,
    at: nowIso(),
    toolExecutionRunId,
    reasonCode,
    finalStatus,
  }
}

export function formatManualCloudAgentImportEvent(event: ManualCloudAgentImportEvent): string {
  return `[manual-import:${event.type}] run=${event.toolExecutionRunId} reason=${event.reasonCode}`
}
