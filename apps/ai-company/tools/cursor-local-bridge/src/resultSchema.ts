/**
 * Cursor Local Bridge — result.json validation (AI-COMPANY-113E).
 */

import fs from 'node:fs'
import { assertPayloadSafe } from './security.ts'
import type { CursorLocalResultJson } from './types.ts'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function parseCursorLocalResultJson(raw: unknown, expectedRunId: string): CursorLocalResultJson {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('result.json must be a JSON object.')
  }

  const record = raw as Record<string, unknown>
  const runId = typeof record.runId === 'string' ? record.runId.trim() : ''
  if (!runId) throw new Error('result.json runId is required.')
  if (runId !== expectedRunId) {
    throw new Error(`result.json runId mismatch (expected ${expectedRunId}, got ${runId}).`)
  }

  const status = record.status
  if (status !== 'completed' && status !== 'failed' && status !== 'partial') {
    throw new Error('result.json status must be completed, failed, or partial.')
  }

  const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
  if (!summary) throw new Error('result.json summary is required.')

  const completedAt = typeof record.completedAt === 'string' ? record.completedAt.trim() : ''
  if (!completedAt) throw new Error('result.json completedAt is required.')

  const result: CursorLocalResultJson = {
    runId,
    status,
    summary,
    changedFiles: isStringArray(record.changedFiles) ? record.changedFiles : [],
    checks: isStringArray(record.checks) ? record.checks : [],
    commit: typeof record.commit === 'string' ? record.commit : null,
    pullRequest: typeof record.pullRequest === 'string' ? record.pullRequest : null,
    warnings: isStringArray(record.warnings) ? record.warnings : [],
    errors: isStringArray(record.errors) ? record.errors : [],
    completedAt,
  }

  assertPayloadSafe(
    {
      summary: result.summary,
      changedFiles: JSON.stringify(result.changedFiles),
      checks: JSON.stringify(result.checks),
      commit: result.commit ?? '',
      pullRequest: result.pullRequest ?? '',
      warnings: JSON.stringify(result.warnings),
      errors: JSON.stringify(result.errors),
    },
    'Outbox result',
  )

  return result
}

export function readAndValidateResultFile(
  filePath: string,
  expectedRunId: string,
): CursorLocalResultJson {
  const rawText = fs.readFileSync(filePath, 'utf8')
  const parsed: unknown = JSON.parse(rawText)
  return parseCursorLocalResultJson(parsed, expectedRunId)
}
