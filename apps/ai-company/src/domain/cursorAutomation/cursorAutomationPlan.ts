/**
 * Cursor Automation — plan builder (AI-COMPANY-097C).
 */

import type { MaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoop'
import type { CursorAutomationPlan } from './cursorAutomationTypes'
import { CURSOR_AUTOMATION_RULE_REFS } from './cursorAutomationRules'

const DEFAULT_REPO = 'servicemanager-ai-2.0'
const DEFAULT_REPO_PATH = '/Users/igor/Documents/GitHub/servicemanager-ai-2.0'
const DEFAULT_BASE_BRANCH = 'ai-company-flow'
const DEFAULT_SCOPE = ['apps/ai-company/**', 'docs/ai-company/**']

const IMPLEMENTATION_KEYWORDS = [
  'implement',
  'реализ',
  'создай',
  'добав',
  'fix',
  'исправ',
  'refactor',
  'рефактор',
  'pr',
  'pull request',
  'cursor',
  'automation',
  'codex',
  'commit',
  'коммит',
  'build',
  'workflow',
]

export function detectExternalExecutorNeed(taskText: string): {
  required: boolean
  reason: string | null
} {
  const normalized = taskText.trim().toLowerCase()
  if (!normalized) {
    return { required: false, reason: null }
  }

  const hit = IMPLEMENTATION_KEYWORDS.find((keyword) => normalized.includes(keyword))
  if (!hit) {
    return { required: false, reason: null }
  }

  return {
    required: true,
    reason: `Задача содержит сигнал внешнего исполнителя («${hit}»): нужен Cursor Automation для кода/PR.`,
  }
}

function inferFileScope(taskText: string): string[] {
  const scopes = [...DEFAULT_SCOPE]
  if (/frontend|ui|react|tsx/i.test(taskText)) {
    scopes.push('apps/ai-company/src/components/**', 'apps/ai-company/src/pages/**')
  }
  if (/backend|nest|prisma/i.test(taskText)) {
    scopes.push('backend/**')
  }
  if (/doc|документ/i.test(taskText)) {
    scopes.push('docs/**')
  }
  return [...new Set(scopes)]
}

function inferBranch(taskText: string): string {
  const match = taskText.match(/branch[:\s]+([a-z0-9/_-]+)/i)
  if (match?.[1]) {
    return match[1]
  }
  return DEFAULT_BASE_BRANCH
}

function inferGoal(loop: MaxWorkerLoopRecord): string {
  const task = loop.input.taskText?.trim()
  if (task) {
    return task
  }
  return loop.input.title?.trim() || 'Выполнить задачу Owner в apps/ai-company без нарушения Runtime V1.'
}

export function buildCursorAutomationPlan(loop: MaxWorkerLoopRecord): CursorAutomationPlan {
  const goal = inferGoal(loop)
  const workingBranch = inferBranch(goal)

  return {
    goal,
    repository: DEFAULT_REPO,
    repositoryPath: DEFAULT_REPO_PATH,
    baseBranch: DEFAULT_BASE_BRANCH,
    workingBranch,
    fileScope: inferFileScope(goal),
    forbidden: [
      'Реальный вызов Cursor API / cloud LLM в Runtime V1',
      'Изменения вне указанной области файлов без явного согласования Owner',
      'Деплой на сервер или ручные правки на production',
      'Превращение provider в owner тикета; cross-tenant доступ',
      'Force push в main/master',
      'Коммит .env, секретов, credentials',
      'Изменение runtimeOrchestrator completion flow без отдельной задачи',
    ],
    requiredChecks: [
      'npm --prefix apps/ai-company run build',
      'graphify update . (после изменений кода)',
      'Backend build → frontend build (если затронут backend)',
      'Не ломать technician / linked-client / impersonation / inspection flows',
    ],
    reportFormat: [
      'Task — что сделано',
      'Files — список изменённых файлов',
      'Changes — кратко по каждому файлу',
      'Constraints — что соблюдено',
      'Checks — результаты сборки/тестов',
      'Expected result — что Owner получит после merge',
    ],
    mustNotDo: [
      'Не вызывать Cursor API в этой V1-задаче (mock only)',
      'Не создавать пустые коммиты',
      'Не смешивать рефакторинг и изменение поведения в одном PR без plan',
      'Не превышать 500 строк на файл без декомпозиции',
      'Не push без явного запроса Owner',
    ],
    expectedPullRequest: {
      title: `[ai-company] ${loop.input.title?.slice(0, 72) || 'Cursor Automation handoff'}`,
      descriptionOutline: [
        '## Summary',
        'Краткое описание изменений по задаче Owner.',
        '## Test plan',
        '- npm --prefix apps/ai-company run build',
        '- Ручная проверка UI (если затронут frontend)',
      ],
      targetBranch: DEFAULT_BASE_BRANCH,
    },
    cursorRulesRefs: CURSOR_AUTOMATION_RULE_REFS.map((item) => item.path),
  }
}
