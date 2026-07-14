/**
 * Unified Cursor Result Envelope — public API (AI-COMPANY-110).
 */

export {
  CURSOR_CHECK_RESULT_STATUSES,
  CURSOR_EXECUTION_STATUSES,
  CURSOR_REPOSITORY_ARTIFACT_KINDS,
  CURSOR_REVIEW_STATUSES,
  CURSOR_TRANSPORT_STATUSES,
  type CursorCheckResult,
  type CursorCheckResultStatus,
  type CursorExecutionError,
  type CursorExecutionErrorSource,
  type CursorExecutionStatus,
  type CursorRepositoryArtifact,
  type CursorRepositoryArtifactKind,
  type CursorResultEnvelope,
  type CursorResultEnvelopeValidationIssue,
  type CursorResultEnvelopeValidationResult,
  type CursorReviewStatus,
  type CursorTransportStatus,
} from './cursorResultEnvelopeTypes'

export {
  assertValidCursorResultEnvelope,
  parseCursorResultEnvelope,
  validateCursorResultEnvelope,
} from './cursorResultEnvelopeValidation'

export {
  applyBuilderReview,
  applyMaxReview,
  createPendingAutomationEnvelope,
  createTransportFailureEnvelope,
  normalizeLegacyOutboxEnvelope,
  normalizeLocalBridgeResult,
  normalizeManualCloudAgentResult,
  type ManualCloudAgentResultInput,
} from './cursorResultEnvelopeFactories'

export {
  cloneCursorResultEnvelope,
  serializeCursorResultEnvelope,
} from './cursorResultEnvelopeSerialization'

export {
  mapEnvelopeToToolResultOutput,
  readEnvelopeFromToolResult,
} from './cursorResultEnvelopeAdapters'
