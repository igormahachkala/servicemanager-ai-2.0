import { readEnvelopeFromToolResult } from '../cursorResultEnvelope/cursorResultEnvelopeAdapters'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { ToolResult } from '../toolDispatcher/toolDispatcherTypes'
import type { CursorAutomationExpectedResult } from './cursorAutomationTypes'

export type BuildResultFromEnvelopeOptions = {
  /** Base branch the automation targeted. The envelope does not carry it. */
  baseBranch?: string
}

function deriveBuildStatus(
  envelope: CursorResultEnvelope,
): CursorAutomationExpectedResult['report']['buildStatus'] {
  const anyFailingCheck = envelope.checks.some((c) => c.status === 'failed' || c.status === 'error')
  if (envelope.executionStatus === 'FAILED' || anyFailingCheck) return 'failed'
  if (envelope.executionStatus === 'SUCCEEDED') return 'passed'
  return 'unknown'
}

function derivePrState(
  envelope: CursorResultEnvelope,
): CursorAutomationExpectedResult['pullRequest']['state'] {
  return envelope.pullRequestUrl ? 'open' : 'draft'
}

function deriveTitle(envelope: CursorResultEnvelope): string {
  const summary = (envelope.summary ?? '').trim()
  if (summary) return summary.split('\n')[0].slice(0, 120)
  return 'Cursor automation result'
}

/**
 * Adapter: converts a REAL CursorResultEnvelope (produced by runCursorAutomation +
 * reconcileCursorAutomation) into the structured CursorAutomationExpectedResult that
 * buildCursorResultIntegrationBundle consumes.
 *
 * Feeding the integration with this (source: 'adapter_v1') replaces the mock_v1
 * ingestion that fabricated the result from the pre-declared expectedResult string.
 * Pure and dependency-free — unit-testable without transport or config.
 */
export function buildCursorAutomationResultFromEnvelope(
  envelope: CursorResultEnvelope,
  options: BuildResultFromEnvelopeOptions = {},
): CursorAutomationExpectedResult {
  return {
    pullRequest: {
      title: deriveTitle(envelope),
      url: envelope.pullRequestUrl ?? '',
      branch: envelope.branch ?? '',
      baseBranch: options.baseBranch ?? 'main',
      state: derivePrState(envelope),
    },
    report: {
      summary: envelope.summary ?? '',
      sections: [],
      buildStatus: deriveBuildStatus(envelope),
      checksRun: envelope.checks.map((c) => c.name),
    },
    artifacts: {
      changedFiles: [...envelope.changedFiles],
      commitMessageHint: envelope.commitSha
        ? `commit ${envelope.commitSha.slice(0, 10)}`
        : deriveTitle(envelope),
    },
  }
}

const TERMINAL_STATUSES: ReadonlyArray<CursorResultEnvelope['executionStatus']> = ['SUCCEEDED', 'FAILED']

/**
 * From a completed tool result, extract the real Cursor envelope and map it to the
 * structured automation result — but only when execution has actually TERMINATED
 * (SUCCEEDED/FAILED). Returns null while pending, when no envelope is present, or when
 * there is no result, so the caller keeps the mock/expected path until a real result exists.
 */
export function resolveActualResultFromToolResult(
  result: ToolResult | null,
  options: BuildResultFromEnvelopeOptions = {},
): CursorAutomationExpectedResult | null {
  if (!result) return null
  const envelope = readEnvelopeFromToolResult(result)
  if (!envelope) return null
  if (!TERMINAL_STATUSES.includes(envelope.executionStatus)) return null
  return buildCursorAutomationResultFromEnvelope(envelope, options)
}
