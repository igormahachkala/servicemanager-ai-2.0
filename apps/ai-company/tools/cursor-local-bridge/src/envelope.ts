/**
 * Cursor Local Bridge — inbox envelope writer (AI-COMPANY-113E).
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  CURSOR_LOCAL_INBOX_RELATIVE,
  CURSOR_LOCAL_OUTBOX_RELATIVE,
  type CursorBridgeConfig,
} from './config.ts'
import { assertPayloadSafe, sanitizeText } from './security.ts'
import type { CursorBridgeEnqueueRequest } from './types.ts'

export type InboxMetadata = {
  version: 'v1'
  runId: string
  toolExecutionRunId: string
  workItemId: string | null
  employeeId: string | null
  companyId: string | null
  title: string
  repositoryRelativeRoot: string
  inboxRelativePath: string
  outboxRelativePath: string
  fileScope: string[]
  createdAt: string
  source: 'cursor_local_bridge'
}

export type InboxWriteOutcome = {
  runId: string
  inboxAbsolutePath: string
  inboxRelativePath: string
  outboxRelativePath: string
  files: string[]
}

function buildChecksMarkdown(checks: string[]): string {
  if (checks.length === 0) {
    return ['# Checks', '', '- npm --prefix apps/ai-company run build'].join('\n')
  }
  return ['# Checks', '', ...checks.map((item) => `- ${sanitizeText(item)}`)].join('\n')
}

function buildTaskMarkdown(request: CursorBridgeEnqueueRequest, runId: string): string {
  const scope = request.fileScope ?? []
  return [
    `# ${sanitizeText(request.title.trim())}`,
    '',
    `Run: \`${runId}\``,
    '',
    '## Instructions',
    sanitizeText(request.instructions.trim()),
    '',
    '## File scope',
    ...(scope.length > 0 ? scope.map((item) => `- ${item}`) : ['- apps/ai-company/**']),
    '',
    '## Policy',
    '- Cursor is an external tool — work happens in an active Cursor session.',
    '- No secrets, tokens, environment variable files, private keys, or hardcoded IP in this package.',
    '- Place result in `.ai-company/cursor-outbox/<runId>/result.json` when done.',
  ].join('\n')
}

function buildExpectedResultMarkdown(expectedResult: string | undefined): string {
  const body = expectedResult?.trim() || 'Describe the observable outcome Owner can verify.'
  return ['# Expected result', '', sanitizeText(body)].join('\n')
}

function buildReadmeMarkdown(runId: string): string {
  return [
    '# Cursor Local Bridge — task package',
    '',
    'This folder was created by **AI Company Cursor Local Bridge** (113E).',
    '',
    '## What is automated',
    '- Task files written to disk',
    '- Cursor may open `task.md` and the workspace (if CLI is available)',
    '',
    '## What requires manual action',
    '- Complete the work in Cursor (Composer / Agent / edits)',
    '- Write result to outbox:',
    '',
    '```',
    `.ai-company/cursor-outbox/${runId}/result.json`,
    '```',
    '',
    '## Not automated',
    '- No Cursor Cloud API',
    '- No autonomous agent execution claim',
    '- Bridge does not read secrets or environment variable files',
  ].join('\n')
}

export function writeInboxEnvelope(
  config: CursorBridgeConfig,
  request: CursorBridgeEnqueueRequest,
): InboxWriteOutcome {
  const runId = request.runId.trim()
  if (!runId) throw new Error('runId is required.')

  const inboxRelativePath = `${CURSOR_LOCAL_INBOX_RELATIVE}/${runId}`
  const outboxRelativePath = `${CURSOR_LOCAL_OUTBOX_RELATIVE}/${runId}`
  const inboxAbsolutePath = path.join(config.repositoryRoot, inboxRelativePath)

  const taskMarkdown = buildTaskMarkdown(request, runId)
  const expectedResultMarkdown = buildExpectedResultMarkdown(request.expectedResult)
  const checksMarkdown = buildChecksMarkdown(request.checks ?? [])
  const readmeMarkdown = buildReadmeMarkdown(runId)

  const metadata: InboxMetadata = {
    version: 'v1',
    runId,
    toolExecutionRunId: runId,
    workItemId: request.workItemId ?? null,
    employeeId: request.employeeId ?? null,
    companyId: request.companyId ?? null,
    title: sanitizeText(request.title.trim()),
    repositoryRelativeRoot: '.',
    inboxRelativePath,
    outboxRelativePath,
    fileScope: request.fileScope ?? [],
    createdAt: new Date().toISOString(),
    source: 'cursor_local_bridge',
  }

  const metadataJson = JSON.stringify(metadata, null, 2)

  assertPayloadSafe(
    {
      taskMarkdown,
      expectedResultMarkdown,
      checksMarkdown,
      readmeMarkdown,
      metadataJson,
    },
    'Inbox envelope',
  )

  fs.mkdirSync(inboxAbsolutePath, { recursive: true })

  const files: Record<string, string> = {
    'task.md': taskMarkdown,
    'metadata.json': metadataJson,
    'expected-result.md': expectedResultMarkdown,
    'checks.md': checksMarkdown,
    'README.md': readmeMarkdown,
  }

  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(inboxAbsolutePath, name), content, 'utf8')
  }

  return {
    runId,
    inboxAbsolutePath,
    inboxRelativePath,
    outboxRelativePath,
    files: Object.keys(files),
  }
}
