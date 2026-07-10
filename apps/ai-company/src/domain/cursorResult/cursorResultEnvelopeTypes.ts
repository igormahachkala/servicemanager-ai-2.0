/**
 * Cursor Result Envelope — canonical contract (AI-COMPANY-113F).
 * Machine-readable Cursor return for digital employees. No free-text-only results.
 */

export const CURSOR_RESULT_ENVELOPE_VERSION = 'v1' as const

export const CURSOR_RESULT_OUTBOX_RELATIVE = '.ai-company/cursor-outbox'

export const CURSOR_RESULT_ENVELOPE_STATUSES = [
  'completed',
  'failed',
  'partial',
] as const

export type CursorResultEnvelopeStatus = (typeof CURSOR_RESULT_ENVELOPE_STATUSES)[number]

export const CURSOR_RESULT_CHECK_STATUSES = [
  'passed',
  'failed',
  'skipped',
  'error',
] as const

export type CursorResultCheckStatus = (typeof CURSOR_RESULT_CHECK_STATUSES)[number]

export type CursorResultCheck = {
  name: string
  status: CursorResultCheckStatus
  outputSummary: string
}

export type CursorResultCommit = {
  sha: string | null
  message: string | null
  branch: string | null
}

export type CursorResultPullRequest = {
  url: string | null
  title: string | null
  number: number | null
}

export type CursorResultEnvelope = {
  version: typeof CURSOR_RESULT_ENVELOPE_VERSION
  toolExecutionRunId: string
  workItemId: string
  employeeId: string
  status: CursorResultEnvelopeStatus
  summary: string
  changedFiles: string[]
  checks: CursorResultCheck[]
  commit: CursorResultCommit | null
  pullRequest: CursorResultPullRequest | null
  warnings: string[]
  errors: string[]
  assumptions: string[]
  unfinishedItems: string[]
  completedAt: string
}

export function buildCursorResultOutboxRelativePath(toolExecutionRunId: string): string {
  return `${CURSOR_RESULT_OUTBOX_RELATIVE}/${toolExecutionRunId}/result.json`
}

export function buildCursorResultOutboxInstructionsBlock(toolExecutionRunId: string): string {
  const outboxPath = buildCursorResultOutboxRelativePath(toolExecutionRunId)
  return [
    '## Cursor result (required)',
    '',
    'After completing the work and running checks, create:',
    '',
    '```',
    outboxPath,
    '```',
    '',
    'Use the **CursorResultEnvelope v1** schema:',
    '',
    '- `version`: `"v1"`',
    '- `toolExecutionRunId`: this run id',
    '- `workItemId`, `employeeId`: from task metadata',
    '- `status`: `completed` | `failed` | `partial`',
    '- `summary`: short outcome for Builder review',
    '- `changedFiles[]`: relative paths only',
    '- `checks[]`: `{ name, status, outputSummary }` per check',
    '- `commit`: `{ sha, message, branch }` or null',
    '- `pullRequest`: `{ url, title, number }` or null',
    '- `warnings[]`, `errors[]`, `assumptions[]`, `unfinishedItems[]`',
    '- `completedAt`: ISO timestamp',
    '',
    'Do **not** include secrets, tokens, `.env` contents, private keys, or hardcoded IP addresses.',
  ].join('\n')
}
