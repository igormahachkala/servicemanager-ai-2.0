/**
 * Cursor Automation — prompt template + handoff (AI-COMPANY-097C).
 */

import type { MaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoop'
import {
  CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
  CURSOR_AUTOMATION_WORKFLOW_VERSION,
  type CursorAutomationHandoff,
  type CursorAutomationPlan,
} from './cursorAutomationTypes'
import { formatCursorRulesForPrompt } from './cursorAutomationRules'

function createHandoffId(): string {
  return `cah-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildCursorAutomationPromptMarkdown(plan: CursorAutomationPlan): string {
  const fileScope = plan.fileScope.map((item) => `- \`${item}\``).join('\n')
  const forbidden = plan.forbidden.map((item) => `- ${item}`).join('\n')
  const checks = plan.requiredChecks.map((item) => `- ${item}`).join('\n')
  const reportFormat = plan.reportFormat.map((item) => `- ${item}`).join('\n')
  const mustNotDo = plan.mustNotDo.map((item) => `- ${item}`).join('\n')
  const prOutline = plan.expectedPullRequest.descriptionOutline.map((item) => `- ${item}`).join('\n')
  const rules = formatCursorRulesForPrompt()

  return `# Cursor Automation Task (V1 Mock Handoff)

## Цель
${plan.goal}

## Репозиторий
- **Repository:** \`${plan.repository}\`
- **Local path:** \`${plan.repositoryPath}\`

## Ветка
- **Base branch:** \`${plan.baseBranch}\`
- **Working branch:** \`${plan.workingBranch}\`

## Область файлов
${fileScope}

## Запреты
${forbidden}

## Обязательные проверки
${checks}

## Формат отчёта (ответ Cursor Automation → MAX)
${reportFormat}

## Что нельзя делать
${mustNotDo}

## Ожидаемый PR
- **Title:** ${plan.expectedPullRequest.title}
- **Target branch:** \`${plan.expectedPullRequest.targetBranch}\`
- **Description outline:**
${prOutline}

## Правила из .cursor/rules
${rules}

---
**Delivery mode:** mock_v1 — не вызывать Cursor API. Handoff для Owner review и будущей интеграции.
**Tool registry id:** \`${CURSOR_AUTOMATION_TOOL_REGISTRY_ID}\`
`
}

export function buildCursorAutomationHandoff(input: {
  loop: MaxWorkerLoopRecord
  plan: CursorAutomationPlan
  runtimeRunId?: string | null
}): CursorAutomationHandoff {
  const promptMarkdown = buildCursorAutomationPromptMarkdown(input.plan)

  return {
    handoffId: createHandoffId(),
    version: CURSOR_AUTOMATION_WORKFLOW_VERSION,
    employeeId: input.loop.employeeId,
    runtimeRunId: input.runtimeRunId ?? null,
    maxWorkerLoopId: input.loop.id,
    promptMarkdown,
    plan: input.plan,
    createdAt: new Date().toISOString(),
    deliveryMode: 'mock_v1',
  }
}
