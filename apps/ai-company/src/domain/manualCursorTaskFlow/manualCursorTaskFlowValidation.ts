/**
 * Manual Cursor Task Flow — validation (AI-COMPANY-112).
 */

import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import type { CreateManualCursorOwnerTaskInput } from './manualCursorTaskFlowTypes'

const SECRET_PATTERNS = [
  /\bcrsr_[a-z0-9]+\b/i,
  /\bBearer\s+[a-z0-9._-]+\b/i,
  /\b(api[_-]?key|secret|token|password)\s*[:=]\s*\S+/i,
]

export type ManualCursorTaskValidationResult =
  | { ok: true; input: CreateManualCursorOwnerTaskInput }
  | { ok: false; message: string }

function containsSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value))
}

function scanForSecrets(input: CreateManualCursorOwnerTaskInput): string | null {
  const fields = [
    input.title,
    input.instruction,
    input.expectedResult,
    input.repository,
    input.baseBranch,
    ...(input.fileScope ?? []),
    ...(input.checks ?? []),
  ]
  for (const field of fields) {
    if (containsSecret(field)) {
      return 'Task input must not contain secrets or API keys.'
    }
  }
  return null
}

export function validateCreateManualCursorOwnerTaskInput(
  raw: CreateManualCursorOwnerTaskInput,
): ManualCursorTaskValidationResult {
  if (raw.environment !== 'dev') {
    return {
      ok: false,
      message: 'First real Cursor task flow is DEV-only. Stage and Production are not allowed.',
    }
  }

  if (!raw.title?.trim()) {
    return { ok: false, message: 'title is required.' }
  }
  if (!raw.instruction?.trim()) {
    return { ok: false, message: 'instruction is required.' }
  }
  if (!raw.expectedResult?.trim()) {
    return { ok: false, message: 'expectedResult is required.' }
  }
  if (!raw.repository?.trim()) {
    return { ok: false, message: 'repository is required.' }
  }
  if (!raw.baseBranch?.trim()) {
    return { ok: false, message: 'baseBranch is required.' }
  }

  const employeeId = raw.assignedEmployeeId?.trim()
  if (employeeId !== EMPLOYEE_ROUTE_IDS.builder) {
    return {
      ok: false,
      message: 'First flow supports Builder employee only.',
    }
  }

  const secretError = scanForSecrets(raw)
  if (secretError) {
    return { ok: false, message: secretError }
  }

  return {
    ok: true,
    input: {
      ...raw,
      title: raw.title.trim(),
      instruction: raw.instruction.trim(),
      expectedResult: raw.expectedResult.trim(),
      repository: raw.repository.trim(),
      baseBranch: raw.baseBranch.trim(),
      assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
      fileScope: (raw.fileScope ?? ['tmp/first-real-ai-company-task.txt']).map((item) => item.trim()).filter(Boolean),
      checks: (
        raw.checks ?? [
          'npm --prefix apps/ai-company run test:domain',
          'npm --prefix apps/ai-company run build',
        ]
      )
        .map((item) => item.trim())
        .filter(Boolean),
    },
  }
}

export function isProductionEnvironmentBlocked(environment: string): boolean {
  return environment === 'production' || environment === 'stage'
}
