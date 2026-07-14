/**
 * GitHub Evidence Reader — observability (AI-COMPANY-114).
 */

import type {
  GitHubEvidenceReaderEvent,
  GitHubEvidenceReaderEventType,
  GitHubEvidenceReasonCode,
} from './githubEvidenceReaderTypes'

function nowIso(): string {
  return new Date().toISOString()
}

export function createGitHubEvidenceReaderEvent(
  type: GitHubEvidenceReaderEventType,
  toolExecutionRunId: string,
  reasonCode: GitHubEvidenceReasonCode | string,
  metadata?: Record<string, unknown>,
): GitHubEvidenceReaderEvent {
  return {
    type,
    at: nowIso(),
    toolExecutionRunId,
    reasonCode,
    metadata,
  }
}

export function formatGitHubEvidenceReaderEvent(event: GitHubEvidenceReaderEvent): string {
  return `[github-evidence:${event.type}] run=${event.toolExecutionRunId} reason=${event.reasonCode}`
}
