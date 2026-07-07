import type { MaxWorkerLoopPhase } from './maxWorkerLoop'

/** Owner-visible steps — subset of domain phases, no fake progress. */
export const MAX_WORKER_LOOP_UI_STEP_IDS = [
  'decision_plan',
  'task_intake',
  'analysis',
  'reasoning',
  'plan',
  'tool_check',
  'memory_draft',
  'knowledge_draft',
  'next_actions',
] as const

export type MaxWorkerLoopUiStepId = (typeof MAX_WORKER_LOOP_UI_STEP_IDS)[number]

export type MaxWorkerLoopPhaseGuide = {
  whatHappens: string
  whatNext: string
}

const DOMAIN_PHASES_BY_UI_STEP: Record<MaxWorkerLoopUiStepId, MaxWorkerLoopPhase[]> = {
  decision_plan: ['decision_plan', 'model_selection'],
  task_intake: ['owner_task', 'max_intake'],
  analysis: ['analysis'],
  reasoning: ['ollama_reasoning'],
  plan: ['plan'],
  tool_check: ['tool_need_check'],
  memory_draft: ['memory_evolution_draft', 'runtime_report'],
  knowledge_draft: ['knowledge_candidate_draft'],
  next_actions: ['next_actions'],
}

export function domainPhasesForUiStep(stepId: MaxWorkerLoopUiStepId): MaxWorkerLoopPhase[] {
  return DOMAIN_PHASES_BY_UI_STEP[stepId]
}

export function uiStepIdForDomainPhase(phase: MaxWorkerLoopPhase): MaxWorkerLoopUiStepId | null {
  for (const stepId of MAX_WORKER_LOOP_UI_STEP_IDS) {
    if (DOMAIN_PHASES_BY_UI_STEP[stepId].includes(phase)) return stepId
  }
  return null
}

/** Static RU copy — UI i18n mirrors these keys in maxWorkerLoop.phaseGuide. */
export const MAX_WORKER_LOOP_PHASE_GUIDE_RU: Record<
  MaxWorkerLoopUiStepId,
  MaxWorkerLoopPhaseGuide & { label: string }
> = {
  decision_plan: {
    label: 'Decision Plan (Brain)',
    whatHappens: 'MAX Brain анализирует задачу Owner и строит Decision Plan: intent, модель, инструменты, Owner Approval.',
    whatNext: 'Model selection → Task Runner → Local Ollama reasoning.',
  },
  task_intake: {
    label: 'Получение задачи',
    whatHappens: 'MAX принимает формулировку Owner, фиксирует контекст проекта и workspace.',
    whatNext: 'Задача передаётся в Runtime — начнётся reasoning через Local Ollama.',
  },
  analysis: {
    label: 'Анализ',
    whatHappens: 'MAX разбирает задачу: scope, ограничения, ожидаемый результат.',
    whatNext: 'На основе анализа формируется reasoning и структура ответа.',
  },
  reasoning: {
    label: 'Reasoning',
    whatHappens: 'Local Ollama выполняет inference — MAX рассуждает без опасных tool calls.',
    whatNext: 'Из ответа модели извлекаются выводы, риски и план действий.',
  },
  plan: {
    label: 'План',
    whatHappens: 'MAX формирует practical шаги и рекомендации для Owner.',
    whatNext: 'Проверяется, нужны ли внешние инструменты (V1: только проверка, без вызова).',
  },
  tool_check: {
    label: 'Проверка необходимости инструментов',
    whatHappens: 'MAX оценивает, требуется ли shell/git/docker или Tool Registry.',
    whatNext: 'В V1 safe mode инструменты не вызываются — переход к отчёту и черновикам.',
  },
  memory_draft: {
    label: 'Memory Evolution Draft',
    whatHappens: 'Из Runtime Report извлекаются уроки — черновик без автопубликации.',
    whatNext: 'Owner сможет одобрить перенос в Employee Memory (V2).',
  },
  knowledge_draft: {
    label: 'Knowledge Candidate',
    whatHappens: 'Findings и best practices оформляются как черновики Knowledge.',
    whatNext: 'Кандидаты ждут review Owner перед публикацией в каталог.',
  },
  next_actions: {
    label: 'Next Actions',
    whatHappens: 'Формируются следующие шаги: решения Owner, follow-up, рекомендации.',
    whatNext: 'Owner выбирает действие в Run Task, Reports или Task Results.',
  },
}
