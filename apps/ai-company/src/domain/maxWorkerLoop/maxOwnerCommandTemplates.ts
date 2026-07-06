import type { MaxWorkerLoopInput } from './maxWorkerLoop'

export const MAX_OWNER_COMMAND_TEMPLATE_IDS = [
  'runtime-ru-i18n',
  'screen-qa',
  'find-mocks',
  'cursor-handoff',
  'report-next-step',
] as const

export type MaxOwnerCommandTemplateId = (typeof MAX_OWNER_COMMAND_TEMPLATE_IDS)[number]

export type MaxOwnerCommandTemplateHints = {
  cursorLikely: boolean
  ownerApprovalLikely: boolean
  memoryLikely: boolean
  knowledgeLikely: boolean
}

export type MaxOwnerCommandTemplate = {
  id: MaxOwnerCommandTemplateId
  input: MaxWorkerLoopInput
  hints: MaxOwnerCommandTemplateHints
}

const AI_COMPANY_PROJECT = 'project-ai-company'
const MAX_WORKSPACE = 'ws-max'

export const MAX_OWNER_COMMAND_TEMPLATES: Record<
  MaxOwnerCommandTemplateId,
  MaxOwnerCommandTemplate
> = {
  'runtime-ru-i18n': {
    id: 'runtime-ru-i18n',
    hints: {
      cursorLikely: true,
      ownerApprovalLikely: true,
      memoryLikely: true,
      knowledgeLikely: true,
    },
    input: {
      taskText:
        'Проверить русификацию Runtime: Run Task, Runtime Live, MAX Worker Loop и Help Center. Найти пропущенные i18n ключи, предложить правки и подготовить handoff для Cursor Automation при необходимости.',
      title: 'Проверка русификации Runtime',
      projectId: AI_COMPANY_PROJECT,
      workspaceId: MAX_WORKSPACE,
      mode: 'documentation',
      modelMode: 'coding',
      priority: 'high',
      expectedOutput:
        'Runtime Report с findings по RU/EN ключам, список экранов с gaps, рекомендации и draft Memory/Knowledge.',
      constraints: 'Только локальный код ai-company; без деплоя; Cursor — mock V1 до Owner Approval.',
    },
  },
  'screen-qa': {
    id: 'screen-qa',
    hints: {
      cursorLikely: false,
      ownerApprovalLikely: false,
      memoryLikely: true,
      knowledgeLikely: false,
    },
    input: {
      taskText:
        'Провести QA экрана Run Task / Owner Command для MAX: проверить copy, guided hints, disabled states кнопки Start и переход после запуска в Runtime Live / MAX Worker Loop.',
      title: 'QA экрана Run Task — MAX Owner Command',
      projectId: AI_COMPANY_PROJECT,
      workspaceId: MAX_WORKSPACE,
      mode: 'technical_audit',
      modelMode: 'coding',
      priority: 'medium',
      expectedOutput: 'Чек-лист QA, найденные UX/copy gaps, severity и next actions.',
      constraints: 'Без правок кода — только audit и отчёт; implementation через Cursor при необходимости.',
    },
  },
  'find-mocks': {
    id: 'find-mocks',
    hints: {
      cursorLikely: false,
      ownerApprovalLikely: false,
      memoryLikely: true,
      knowledgeLikely: true,
    },
    input: {
      taskText:
        'Найти mock-данные и stub-flow в ai-company: autonomous demo, Cursor Automation mock, fake progress, placeholder adapters. Составить карту что real vs mock для Owner.',
      title: 'Аудит mock-данных ai-company',
      projectId: AI_COMPANY_PROJECT,
      workspaceId: MAX_WORKSPACE,
      mode: 'technical_audit',
      modelMode: 'coding',
      priority: 'medium',
      expectedOutput: 'Таблица mock vs real по модулям, риски для Owner и рекомендации по V2.',
      constraints: 'Read-only audit; не вызывать shell/git/Cursor API.',
    },
  },
  'cursor-handoff': {
    id: 'cursor-handoff',
    hints: {
      cursorLikely: true,
      ownerApprovalLikely: true,
      memoryLikely: false,
      knowledgeLikely: true,
    },
    input: {
      taskText:
        'Подготовить задачу для Cursor: сформулировать Owner goal, scope файлов, build/checklist, expected PR и handoff prompt для Cursor Automation (mock V1).',
      title: 'Handoff задачи для Cursor Automation',
      projectId: AI_COMPANY_PROJECT,
      workspaceId: MAX_WORKSPACE,
      mode: 'handoff_preparation',
      modelMode: 'coding',
      priority: 'high',
      expectedOutput:
        'Structured handoff: goal, files, checks, expected PR summary; Tool Branch plan для Owner Approval.',
      constraints: 'Owner Approval обязателен перед Submit to Cursor Automation.',
    },
  },
  'report-next-step': {
    id: 'report-next-step',
    hints: {
      cursorLikely: false,
      ownerApprovalLikely: false,
      memoryLikely: true,
      knowledgeLikely: true,
    },
    input: {
      taskText:
        'Проверить последний Runtime Report MAX и предложить следующий шаг для Owner: что уже сделано, что blocked, что требует approval или Cursor.',
      title: 'Review отчёта и next step',
      projectId: AI_COMPANY_PROJECT,
      workspaceId: MAX_WORKSPACE,
      mode: 'documentation',
      modelMode: 'coding',
      priority: 'medium',
      expectedOutput: 'Executive summary, 1–3 next actions с приоритетом и ссылками на Live/Report.',
      constraints: 'Опираться на localStorage runs/reports; без внешних API.',
    },
  },
}

export function isMaxOwnerCommandTemplateId(value: string): value is MaxOwnerCommandTemplateId {
  return (MAX_OWNER_COMMAND_TEMPLATE_IDS as readonly string[]).includes(value)
}

export function getMaxOwnerCommandTemplate(
  id: MaxOwnerCommandTemplateId,
): MaxOwnerCommandTemplate {
  return MAX_OWNER_COMMAND_TEMPLATES[id]
}

export function listMaxOwnerCommandTemplates(): MaxOwnerCommandTemplate[] {
  return MAX_OWNER_COMMAND_TEMPLATE_IDS.map((id) => MAX_OWNER_COMMAND_TEMPLATES[id])
}
