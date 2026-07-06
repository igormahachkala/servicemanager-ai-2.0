import type { MaxWorkerLoopInput } from './maxWorkerLoop'

export const AUTONOMOUS_DEMO_SCENARIO_IDS = ['runtime-ru-i18n', 'help-center-runtime'] as const

export type AutonomousDemoScenarioId = (typeof AUTONOMOUS_DEMO_SCENARIO_IDS)[number]

export type AutonomousDemoScenario = {
  id: AutonomousDemoScenarioId
  title: string
  summary: string
  /** Owner-visible goal — triggers Cursor Automation when contains implementation keywords. */
  input: MaxWorkerLoopInput
}

const AI_COMPANY_PROJECT = 'project-ai-company'
const MAX_WORKSPACE = 'ws-max'

export const AUTONOMOUS_DEMO_SCENARIOS: Record<AutonomousDemoScenarioId, AutonomousDemoScenario> = {
  'runtime-ru-i18n': {
    id: 'runtime-ru-i18n',
    title: 'Первый автономный цикл — русификация Runtime',
    summary:
      'MAX анализирует задачу через Ollama, решает что нужен Cursor Automation, формирует plan и mock PR — без shell и Cursor API.',
    input: {
      taskText:
        'Исправить русификацию Runtime Live, Run Task и MAX Worker Loop: проверить i18n ключи, добавить недостающие подписи Help Center для фаз цикла. Подготовить PR через Cursor Automation (mock V1).',
      title: 'Русификация Runtime — autonomous demo',
      projectId: AI_COMPANY_PROJECT,
      workspaceId: MAX_WORKSPACE,
      mode: 'documentation',
      modelMode: 'coding',
      priority: 'high',
      expectedOutput:
        'Runtime Report с findings по i18n, Cursor Automation plan, mock PR summary, черновики Memory/Knowledge.',
      constraints:
        'Autonomous Demo V1: real Ollama reasoning; mock Owner Approval, mock Cursor submit/PR; без shell, git, Cursor API.',
    },
  },
  'help-center-runtime': {
    id: 'help-center-runtime',
    title: 'Help Center — объяснение Runtime для Owner',
    summary:
      'MAX добавляет guided copy в Help Center для Run Task / Runtime Live — полный цикл с Tool Decision и mock PR.',
    input: {
      taskText:
        'Добавить в Help Center понятное объяснение Runtime Live и MAX Worker Loop для Owner: что real, что mock, где Owner Approval. Cursor Automation подготовит docs/ изменения (mock).',
      title: 'Help Center Runtime guide — autonomous demo',
      projectId: AI_COMPANY_PROJECT,
      workspaceId: MAX_WORKSPACE,
      mode: 'documentation',
      modelMode: 'coding',
      priority: 'medium',
      expectedOutput: 'Structured report + Knowledge candidates для Help Center.',
      constraints: 'Autonomous Demo V1 — без реального PR merge.',
    },
  },
}

export function isAutonomousDemoScenarioId(value: string): value is AutonomousDemoScenarioId {
  return (AUTONOMOUS_DEMO_SCENARIO_IDS as readonly string[]).includes(value)
}

export function getAutonomousDemoScenario(id: AutonomousDemoScenarioId): AutonomousDemoScenario {
  return AUTONOMOUS_DEMO_SCENARIOS[id]
}

export function listAutonomousDemoScenarios(): AutonomousDemoScenario[] {
  return AUTONOMOUS_DEMO_SCENARIO_IDS.map((id) => AUTONOMOUS_DEMO_SCENARIOS[id])
}

export const DEFAULT_AUTONOMOUS_DEMO_SCENARIO_ID: AutonomousDemoScenarioId = 'runtime-ru-i18n'
