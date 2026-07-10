/**
 * Build Cursor local task envelope files (AI-COMPANY-113C).
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import {
  CURSOR_LOCAL_ADAPTER_VERSION,
  type CursorLocalTaskEnvelope,
  type CursorLocalTaskMetadata,
  type PrepareCursorLocalTaskInput,
} from './cursorLocalAdapterTypes'
import {
  CURSOR_LOCAL_INBOX_RELATIVE,
  CURSOR_LOCAL_OUTBOX_RELATIVE,
} from './cursorLocalAdapterDetect'
import { assertCursorLocalPayloadSafe, sanitizeCursorLocalText } from './cursorLocalAdapterSecurity'
import { buildCursorResultOutboxInstructionsBlock } from '../cursorResult/cursorResultEnvelopeTypes'
import { saveCursorLocalTaskEnvelope } from './cursorLocalAdapterStorage'

function createEnvelopeId(): string {
  return `clenv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildChecksMarkdown(checks: string[]): string {
  if (checks.length === 0) {
    return ['# Checks', '', '- npm --prefix apps/ai-company run build'].join('\n')
  }
  return ['# Checks', '', ...checks.map((item) => `- ${sanitizeCursorLocalText(item)}`)].join('\n')
}

function buildTaskMarkdown(input: PrepareCursorLocalTaskInput, envelopeId: string): string {
  const scope = input.fileScope ?? []
  const runId = input.toolExecutionRunId?.trim()
  const lines = [
    `# ${sanitizeCursorLocalText(input.title.trim())}`,
    '',
    runId ? `Run: \`${runId}\`` : `Envelope: \`${envelopeId}\``,
    '',
    '## Instructions',
    sanitizeCursorLocalText(input.instructions.trim()),
    '',
    '## File scope',
    ...(scope.length > 0 ? scope.map((item) => `- ${item}`) : ['- apps/ai-company/**']),
    '',
    '## Policy',
    '- Cursor is an external tool, not a digital employee.',
    '- No secrets, tokens, `.env`, private keys, or hardcoded IP in this package.',
  ]

  if (runId) {
    lines.push('', buildCursorResultOutboxInstructionsBlock(runId))
  } else {
    lines.push('- Return summary via outbox result.json or Owner ingest in AI Company.')
  }

  return lines.join('\n')
}

function buildExpectedResultMarkdown(expectedResult: string | null | undefined): string {
  const body = expectedResult?.trim() || 'Describe the observable outcome Owner can verify.'
  return ['# Expected result', '', sanitizeCursorLocalText(body)].join('\n')
}

export function prepareCursorLocalTask(input: PrepareCursorLocalTaskInput): CursorLocalTaskEnvelope {
  const envelopeId = createEnvelopeId()
  const createdAt = new Date().toISOString()
  const inboxFolder = `${CURSOR_LOCAL_INBOX_RELATIVE}/${envelopeId}`
  const outboxFolder = `${CURSOR_LOCAL_OUTBOX_RELATIVE}/${envelopeId}`

  const taskMarkdown = buildTaskMarkdown(input, envelopeId)
  const expectedResultMarkdown = buildExpectedResultMarkdown(input.expectedResult)
  const checksMarkdown = buildChecksMarkdown(input.checks ?? [])
  const metadata: CursorLocalTaskMetadata = {
    envelopeId,
    version: CURSOR_LOCAL_ADAPTER_VERSION,
    toolExecutionRunId: input.toolExecutionRunId ?? null,
    workItemId: input.workItemId ?? null,
    employeeId: input.employeeId ?? null,
    companyId: input.companyId ?? DEFAULT_COMPANY_ID,
    title: sanitizeCursorLocalText(input.title.trim()),
    repositoryRelativeRoot: input.repositoryRelativeRoot ?? '.',
    inboxRelativePath: inboxFolder,
    outboxRelativePath: outboxFolder,
    fileScope: input.fileScope ?? [],
    createdAt,
    source: input.toolExecutionRunId ? 'tool_execution_run' : 'manual',
  }

  assertCursorLocalPayloadSafe({
    taskMarkdown,
    expectedResultMarkdown,
    checksMarkdown,
    metadata: JSON.stringify(metadata),
  })

  const envelope: CursorLocalTaskEnvelope = {
    envelopeId,
    taskMarkdown,
    metadata,
    expectedResultMarkdown,
    checksMarkdown,
    relativeInboxPath: inboxFolder,
    relativeOutboxPath: outboxFolder,
    createdAt,
  }

  return saveCursorLocalTaskEnvelope(envelope)
}

/** File bundle for export / future filesystem writer. */
export function buildCursorLocalTaskFileBundle(envelope: CursorLocalTaskEnvelope): Record<string, string> {
  return {
    'task.md': envelope.taskMarkdown,
    'metadata.json': JSON.stringify(envelope.metadata, null, 2),
    'expected-result.md': envelope.expectedResultMarkdown,
    'checks.md': envelope.checksMarkdown,
  }
}
