/**
 * Builder Automation Task Flow — validation (AI-COMPANY-113).
 */

import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import type { CreateBuilderAutomationOwnerTaskInput } from './builderAutomationTaskFlowTypes'

const SECRET_PATTERNS = [
  /\bcrsr_[a-z0-9]+\b/i,
  /\bBearer\s+[a-z0-9._-]+\b/i,
  /\b(api[_-]?key|secret|token|password)\s*[:=]\s*\S+/i,
]

export type BuilderAutomationValidationResult =
  | { ok: true; input: CreateBuilderAutomationOwnerTaskInput }
  | { ok: false; message: string }

function containsSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value))
}

export function validateCreateBuilderAutomationOwnerTaskInput(
  raw: CreateBuilderAutomationOwnerTaskInput,
): BuilderAutomationValidationResult {
  if ((raw.environment ?? 'dev') !== 'dev') {
    return {
      ok: false,
      message: 'Autonomous Builder Cursor Automation flow is DEV-only.',
    }
  }

  if (!raw.title?.trim()) return { ok: false, message: 'title is required.' }
  if (!raw.instruction?.trim()) return { ok: false, message: 'instruction is required.' }
  if (!raw.expectedResult?.trim()) return { ok: false, message: 'expectedResult is required.' }
  if (!raw.repository?.trim()) return { ok: false, message: 'repository is required.' }
  if (!raw.baseBranch?.trim()) return { ok: false, message: 'baseBranch is required.' }

  const employeeId = raw.assignedEmployeeId?.trim()
  if (employeeId && employeeId !== EMPLOYEE_ROUTE_IDS.builder) {
    return { ok: false, message: 'Autonomous Builder flow supports Builder employee only.' }
  }

  const fields = [
    raw.title,
    raw.instruction,
    raw.expectedResult,
    raw.repository,
    raw.baseBranch,
    ...(raw.fileScope ?? []),
    ...(raw.checks ?? []),
    ...(raw.constraints ?? []),
  ]
  for (const field of fields) {
    if (field && containsSecret(field)) {
      return { ok: false, message: 'Task input must not contain secrets or API keys.' }
    }
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
      environment: 'dev',
      requiresRepositoryWrite: raw.requiresRepositoryWrite ?? true,
      requiresCommitOrPullRequest: raw.requiresCommitOrPullRequest ?? true,
      fileScope: (raw.fileScope ?? ['tmp/autonomous-builder-test.txt'])
        .map((item) => item.trim())
        .filter(Boolean),
      checks: (
        raw.checks ?? [
          'npm --prefix apps/ai-company run test:domain',
          'npm --prefix apps/ai-company run build',
        ]
      )
        .map((item) => item.trim())
        .filter(Boolean),
      constraints: (raw.constraints ?? []).map((item) => item.trim()).filter(Boolean),
    },
  }
}
