/**
 * Cursor Automation — Builder instruction template (AI-COMPANY-113).
 */

import type { BuilderAutomationPayload } from './cursorAutomationRunnerTypes'

export function buildCursorAutomationInstruction(payload: BuilderAutomationPayload): string {
  const constraints = payload.constraints.map((item) => `- ${item}`).join('\n')
  const checks = payload.requiredChecks.map((item) => `- ${item}`).join('\n')

  return [
    'You are Builder execution worker for AI Company.',
    '',
    `Task ID: ${payload.taskId}`,
    `ToolExecutionRun ID: ${payload.toolExecutionRunId}`,
    `Repository: ${payload.repository}`,
    `Base branch: ${payload.baseBranch}`,
    '',
    'Objective:',
    payload.title,
    '',
    'Instructions:',
    payload.instruction,
    '',
    'Constraints:',
    '- One Task = One Commit',
    '- Do not deploy',
    '- Do not modify Production',
    `- Work only in a new ${payload.callbackHints.branchPrefix}* branch`,
    '- Run required checks',
    '- Commit changes',
    '- Push branch',
    '- Open draft PR if requested',
    `- Create result marker: ${payload.callbackHints.resultMarkerPath}`,
    constraints ? `\nAdditional constraints:\n${constraints}` : '',
    '',
    'Required checks:',
    checks || '- npm --prefix apps/ai-company run test:domain',
    '',
    'Required report:',
    'Task',
    'Files',
    'Changes',
    'Constraints',
    'Checks',
    'Commit',
    'Expected result',
    '',
    `Expected result: ${payload.expectedResult}`,
  ]
    .filter((line, index, arr) => !(line === '' && arr[index - 1] === ''))
    .join('\n')
}

export function buildResultMarkerPath(toolExecutionRunId: string): string {
  return `tmp/ai-company-results/${toolExecutionRunId}.json`
}

export function buildBranchPrefix(): string {
  return 'cursor/'
}
