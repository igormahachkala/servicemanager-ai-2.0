/**
 * Submit Cursor local task — V1 returns unsupported in browser (AI-COMPANY-113C).
 * No fake success.
 */

import {
  detectCursorLocalCapabilities,
} from './cursorLocalAdapterDetect'
import type {
  CursorLocalSubmissionResult,
  SubmitCursorLocalTaskInput,
} from './cursorLocalAdapterTypes'
import { getCursorLocalTaskEnvelope } from './cursorLocalAdapterStorage'

export function submitCursorLocalTask(input: SubmitCursorLocalTaskInput): CursorLocalSubmissionResult {
  const envelope = getCursorLocalTaskEnvelope(input.envelopeId)
  if (!envelope) {
    return {
      status: 'unsupported',
      reason: `Envelope ${input.envelopeId} was not found.`,
      envelopeId: input.envelopeId,
      openedUri: null,
      requiresManualAction: true,
    }
  }

  const capabilities = detectCursorLocalCapabilities()
  const cliOpen = capabilities.find((item) => item.id === 'cli_open_file')
  const agentCli = capabilities.find((item) => item.id === 'cursor_agent_cli')

  if (typeof window !== 'undefined') {
    return {
      status: 'unsupported',
      reason:
        'Browser runtime cannot spawn Cursor CLI or Agent. Export envelope from prepareCursorLocalTask() and open in Cursor manually.',
      envelopeId: envelope.envelopeId,
      openedUri: null,
      requiresManualAction: true,
    }
  }

  if (agentCli?.requiresApiAuth) {
    return {
      status: 'unsupported',
      reason: 'Cursor Agent CLI requires cloud authentication — blocked by no-Cursor-API policy.',
      envelopeId: envelope.envelopeId,
      openedUri: null,
      requiresManualAction: true,
    }
  }

  if (!cliOpen?.available) {
    return {
      status: 'unsupported',
      reason: 'Local Cursor CLI open is not available in this environment.',
      envelopeId: envelope.envelopeId,
      openedUri: null,
      requiresManualAction: true,
    }
  }

  if (input.dryRun) {
    return {
      status: 'prepared',
      reason: 'Dry run — CLI open not executed.',
      envelopeId: envelope.envelopeId,
      openedUri: `${envelope.relativeInboxPath}/task.md`,
      requiresManualAction: true,
    }
  }

  return {
    status: 'unsupported',
    reason: 'CLI submit hook not connected — see AI-COMPANY-113C decision doc.',
    envelopeId: envelope.envelopeId,
    openedUri: null,
    requiresManualAction: true,
  }
}
