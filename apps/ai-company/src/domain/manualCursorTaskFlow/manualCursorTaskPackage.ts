/**
 * Manual Cursor Task Flow — Cursor Task Package (AI-COMPANY-112).
 */

import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import type { ManualCursorTaskFlowMetadata } from './manualCursorTaskFlowTypes'

export function generateCursorTaskPackageText(
  run: ToolExecutionRun,
  metadata: ManualCursorTaskFlowMetadata,
): string {
  const fileScopeLine =
    run.fileScope.length > 0 ? run.fileScope.join(', ') : 'tmp/first-real-ai-company-task.txt'

  const constraints = [
    '- One Task = One Commit',
    '- Do not deploy',
    '- Do not modify Production',
    '- Work only in a new cursor/* branch',
    '- Run required checks',
    '- Create commit',
    '- Push branch',
    metadata.requiresCommitOrPullRequest
      ? '- Open draft PR if requested'
      : '- Open draft PR only if task requires it',
  ]

  const deliverables = [
    `Changed files scope: ${fileScopeLine}`,
    run.expectedResult.trim(),
    'Commit on cursor/* branch',
    metadata.requiresCommitOrPullRequest ? 'Draft pull request URL' : null,
    'Required checks output',
  ].filter((item): item is string => Boolean(item))

  const requiredReport = [
    'Task',
    'Files',
    'Changes',
    'Constraints',
    'Checks',
    'Commit',
    'Expected result',
  ].join('\n')

  return [
    'AI COMPANY TASK',
    '',
    'Task ID:',
    run.id,
    '',
    'Employee:',
    'Builder',
    '',
    'Repository:',
    metadata.repository,
    '',
    'Base branch:',
    metadata.baseBranch,
    '',
    'Objective:',
    run.title,
    '',
    'Instructions:',
    run.instructions,
    '',
    'Constraints:',
    ...constraints,
    '',
    'Expected deliverables:',
    ...deliverables.map((item) => `- ${item}`),
    '',
    'Required checks:',
    ...(run.checks.length > 0 ? run.checks.map((item) => `- ${item}`) : ['- (none specified)']),
    '',
    'Required report:',
    requiredReport,
  ].join('\n')
}

export function cursorTaskPackageContainsSecrets(packageText: string): boolean {
  return /\bcrsr_[a-z0-9]+\b/i.test(packageText) || /\bBearer\s+/i.test(packageText)
}
