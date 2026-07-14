/**
 * Manual Cloud Agent import — unified envelope mapping (AI-COMPANY-111).
 */

import { normalizeManualCloudAgentResult } from '../cursorResultEnvelope/cursorResultEnvelopeFactories'
import type {
  CursorExecutionError,
  CursorRepositoryArtifact,
  CursorResultEnvelope,
} from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { ManualCloudAgentImportInput } from './manualCloudAgentImportTypes'

function mapCheckStatus(
  status: ManualCloudAgentImportInput['checks'][number]['status'],
): 'passed' | 'failed' | 'skipped' {
  if (status === 'PASSED') return 'passed'
  if (status === 'FAILED') return 'failed'
  return 'skipped'
}

function mapImportErrors(errors: ManualCloudAgentImportInput['errors']): CursorExecutionError[] {
  return errors.map((error) => ({
    code: error.code,
    message: error.message,
    source: 'execution' as const,
    terminal: true,
  }))
}

function mapImportArtifacts(
  artifacts: ManualCloudAgentImportInput['artifacts'],
): CursorRepositoryArtifact[] {
  return artifacts.map((artifact) => {
    const kind =
      artifact.type === 'branch' ||
      artifact.type === 'commit' ||
      artifact.type === 'pull_request' ||
      artifact.type === 'file'
        ? artifact.type
        : 'other'
    return {
      kind,
      label: artifact.type,
      value: artifact.reference,
      url: kind === 'pull_request' ? artifact.reference : null,
    }
  })
}

export function buildManualCloudAgentEnvelopeFromImport(
  input: ManualCloudAgentImportInput,
): CursorResultEnvelope {
  const legacyStatus =
    input.finalStatus === 'SUCCEEDED'
      ? 'completed'
      : input.finalStatus === 'FAILED'
        ? 'failed'
        : 'partial'

  const envelope = normalizeManualCloudAgentResult({
    toolExecutionRunId: input.toolExecutionRunId,
    summary: input.summary,
    branch: input.branch ?? '',
    commitSha: input.commitSha ?? '',
    pullRequestUrl: input.pullRequestUrl,
    changedFiles: input.changedFiles,
    checks: input.checks.map((check) => ({
      name: check.name,
      status: mapCheckStatus(check.status),
      outputSummary: check.details ?? null,
    })),
    finalStatus: input.finalStatus,
    status: legacyStatus,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    externalCorrelationId: input.externalCorrelationId,
    errors: mapImportErrors(input.errors),
    artifacts: mapImportArtifacts(input.artifacts),
    metadata: {
      transport: 'manual_cloud_agent',
      importFinalStatus: input.finalStatus,
      ...input.metadata,
    },
  })

  return envelope
}
