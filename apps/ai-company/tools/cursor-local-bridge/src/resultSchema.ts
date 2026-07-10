/**
 * Cursor Local Bridge — result.json validation (AI-COMPANY-113E + 113F v1 envelope).
 */

import fs from 'node:fs'
import { assertPayloadSafe } from './security.ts'
import type { CursorLocalResultJson } from './types.ts'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function resolveRunId(record: Record<string, unknown>): string {
  if (typeof record.toolExecutionRunId === 'string') return record.toolExecutionRunId.trim()
  if (typeof record.runId === 'string') return record.runId.trim()
  return ''
}

function normalizeChecks(record: Record<string, unknown>): string[] {
  if (!Array.isArray(record.checks)) return []
  if (record.checks.every((item) => typeof item === 'string')) {
    return record.checks as string[]
  }
  return record.checks
    .map((item) => {
      if (!isRecord(item) || typeof item.name !== 'string') return null
      const status = typeof item.status === 'string' ? item.status : 'unknown'
      const summary = typeof item.outputSummary === 'string' ? item.outputSummary : ''
      return `${item.name}: ${status}${summary ? ` — ${summary}` : ''}`
    })
    .filter((item): item is string => item !== null)
}

function normalizeCommit(record: Record<string, unknown>): string | null {
  if (typeof record.commit === 'string') return record.commit
  if (!isRecord(record.commit)) return null
  return [record.commit.sha, record.commit.message, record.commit.branch]
    .filter((item) => typeof item === 'string' && item.trim())
    .join(' · ')
}

function normalizePullRequest(record: Record<string, unknown>): string | null {
  if (typeof record.pullRequest === 'string') return record.pullRequest
  if (!isRecord(record.pullRequest)) return null
  if (typeof record.pullRequest.url === 'string') return record.pullRequest.url
  return null
}

export function parseCursorLocalResultJson(raw: unknown, expectedRunId: string): CursorLocalResultJson {
  if (!isRecord(raw)) {
    throw new Error('result.json must be a JSON object.')
  }

  const runId = resolveRunId(raw)
  if (!runId) throw new Error('result.json toolExecutionRunId/runId is required.')
  if (runId !== expectedRunId) {
    throw new Error(`result.json runId mismatch (expected ${expectedRunId}, got ${runId}).`)
  }

  const status = raw.status
  if (status !== 'completed' && status !== 'failed' && status !== 'partial') {
    throw new Error('result.json status must be completed, failed, or partial.')
  }

  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  if (!summary) throw new Error('result.json summary is required.')

  const completedAt = typeof raw.completedAt === 'string' ? raw.completedAt.trim() : ''
  if (!completedAt) throw new Error('result.json completedAt is required.')

  const result: CursorLocalResultJson = {
    runId,
    status,
    summary,
    changedFiles: isStringArray(raw.changedFiles) ? raw.changedFiles : [],
    checks: normalizeChecks(raw),
    commit: normalizeCommit(raw),
    pullRequest: normalizePullRequest(raw),
    warnings: isStringArray(raw.warnings) ? raw.warnings : [],
    errors: isStringArray(raw.errors) ? raw.errors : [],
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
      raw: JSON.stringify(raw),
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
