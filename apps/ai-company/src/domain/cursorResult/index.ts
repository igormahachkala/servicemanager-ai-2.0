export {
  CURSOR_RESULT_ENVELOPE_VERSION,
  CURSOR_RESULT_OUTBOX_RELATIVE,
  buildCursorResultOutboxInstructionsBlock,
  buildCursorResultOutboxRelativePath,
  type CursorResultCheck,
  type CursorResultCommit,
  type CursorResultEnvelope,
  type CursorResultEnvelopeStatus,
  type CursorResultPullRequest,
} from './cursorResultEnvelopeTypes'

export {
  parseCursorResultEnvelope,
  validateCursorResultEnvelope,
  type CursorResultValidationIssue,
  type CursorResultValidationResult,
} from './cursorResultEnvelopeValidation'

export {
  ingestCursorResultEnvelope,
  normalizeLegacyCursorResultRaw,
  type IngestCursorResultOutcome,
} from './cursorResultIngest'
