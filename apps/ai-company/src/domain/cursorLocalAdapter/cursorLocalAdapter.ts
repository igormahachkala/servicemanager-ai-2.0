/**
 * Default Cursor Local Adapter (AI-COMPANY-113C).
 */

import {
  detectCursorLocalCapabilities as detectCapabilities,
  resolveCursorLocalAdapterStatus,
} from './cursorLocalAdapterDetect'
import { readIngestedCursorLocalResult } from './cursorLocalAdapterIngest'
import { pollCursorLocalTask } from './cursorLocalAdapterPoll'
import { prepareCursorLocalTask } from './cursorLocalAdapterPrepare'
import { submitCursorLocalTask } from './cursorLocalAdapterSubmit'
import type {
  CursorLocalAdapter,
  CursorLocalAdapterStatus,
  CursorLocalCapability,
  CursorLocalResultEnvelope,
  CursorLocalSubmissionResult,
  CursorLocalTaskEnvelope,
  PrepareCursorLocalTaskInput,
  SubmitCursorLocalTaskInput,
} from './cursorLocalAdapterTypes'
import type { CursorLocalPollResult } from './cursorLocalAdapterTypes'

export const defaultCursorLocalAdapter: CursorLocalAdapter = {
  detectCapabilities(): CursorLocalCapability[] {
    return detectCapabilities()
  },

  getStatus(): CursorLocalAdapterStatus {
    return resolveCursorLocalAdapterStatus()
  },

  prepareTask(input: PrepareCursorLocalTaskInput): CursorLocalTaskEnvelope {
    return prepareCursorLocalTask(input)
  },

  submitTask(input: SubmitCursorLocalTaskInput): CursorLocalSubmissionResult {
    return submitCursorLocalTask(input)
  },

  pollTask(envelopeId: string): CursorLocalPollResult {
    return pollCursorLocalTask(envelopeId)
  },

  ingestResult(envelopeId: string): CursorLocalResultEnvelope | null {
    return readIngestedCursorLocalResult(envelopeId)
  },
}
