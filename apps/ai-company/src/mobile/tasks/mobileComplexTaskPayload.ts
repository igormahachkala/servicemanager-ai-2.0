import type { WorkPriority } from '../../domain/employeeWorkQueue'
import type { WorkItemStructuredPayload } from '../../domain/employeeWorkQueue/workItemStructuredPayload'
import { WORK_ITEM_STRUCTURED_PAYLOAD_VERSION } from '../../domain/employeeWorkQueue/workItemStructuredPayload'

export type MobileTaskMode = 'quick' | 'complex'

export type MobileComplexTaskTemplateId =
  | 'complex_mobile_audit'
  | 'complex_architecture_review'
  | 'complex_ux_weaknesses'
  | 'complex_dev_plan'
  | 'complex_stage_readiness'
  | 'complex_runtime_errors'
  | 'complex_morning_report'

export type MobileComplexTaskTemplate = {
  id: MobileComplexTaskTemplateId
  title: string
  objective: string
  context: string
  expectedResult: string
  constraints: string
  forbidden: string
  deadline: string
  priority: WorkPriority
  needsReport: boolean
  needsNextSteps: boolean
}

export type MobileComplexTaskFormState = {
  title: string
  objective: string
  context: string
  expectedResult: string
  constraints: string
  forbidden: string
  deadline: string
  priority: WorkPriority
  needsReport: boolean
  needsNextSteps: boolean
  templateId: MobileComplexTaskTemplateId | null
}

export const DEFAULT_COMPLEX_TASK_FORM: MobileComplexTaskFormState = {
  title: '',
  objective: '',
  context: '',
  expectedResult: '',
  constraints: '',
  forbidden: '',
  deadline: '',
  priority: 'medium',
  needsReport: true,
  needsNextSteps: true,
  templateId: null,
}

export const MOBILE_COMPLEX_TASK_TEMPLATES: MobileComplexTaskTemplate[] = [
  {
    id: 'complex_mobile_audit',
    title: 'Провести аудит мобильной версии',
    objective:
      'Провести аудит mobile AI Company: навигация, golden path, Runtime Live, постановка задач, отчёты и UX polish.',
    context:
      'Mobile MVP на /mobile/*; Owner использует iPhone по LAN. Фокус на реальных Owner flow, не desktop parity.',
    expectedResult:
      'Structured audit: что работает, блокеры, UX gaps, приоритетный backlog для mobile V2.',
    constraints: 'Только локальный код и существующие mobile routes; без backend изменений.',
    forbidden: 'Не предлагать fake progress, не менять Runtime architecture.',
    deadline: 'Сегодня / высокий приоритет',
    priority: 'high',
    needsReport: true,
    needsNextSteps: true,
  },
  {
    id: 'complex_architecture_review',
    title: 'Проверить архитектуру AI Company',
    objective:
      'Проверить архитектуру apps/ai-company: domain boundaries, multi-tenant invariants, Worker Loop vs Runtime.',
    context: 'NestJS backend отдельно; ai-company — local-first Owner cockpit с MAX Worker Loop.',
    expectedResult:
      'Architecture brief: сильные стороны, риски, нарушения invariants, рекомендации по refactor.',
    constraints: 'Уважать ticket owner = CLIENT, companyId scope, technician bindings.',
    forbidden: 'Не превращать provider в owner тикета; не обходить policy.',
    deadline: 'На этой неделе',
    priority: 'high',
    needsReport: true,
    needsNextSteps: true,
  },
  {
    id: 'complex_ux_weaknesses',
    title: 'Найти слабые места в UX',
    objective:
      'Найти слабые места UX Owner flow: Today, MAX control, Runtime Live, Reports, Decisions, mobile onboarding.',
    context: 'Mobile-first Owner; desktop Mission Control — secondary.',
    expectedResult:
      'Список UX issues с severity, экранами, воспроизведением и предложениями улучшений.',
    constraints: 'Опираться на существующий design system mobile; без scope creep.',
    forbidden: 'Не добавлять новые product flows без явной необходимости.',
    deadline: 'Средний приоритет',
    priority: 'medium',
    needsReport: true,
    needsNextSteps: true,
  },
  {
    id: 'complex_dev_plan',
    title: 'Подготовить план разработки',
    objective:
      'Подготовить план разработки следующего mobile/desktop sprint для AI Company Owner experience.',
    context: 'Backlog: mobile polish, Runtime diagnostics, task flows, reports, golden path.',
    expectedResult:
      'План: цели sprint, задачи с приоритетами, зависимости, acceptance criteria, риски.',
    constraints: 'Минимальный diff, build must pass, один commit per task где возможно.',
    forbidden: 'Не смешивать refactor и behavior change в одном PR.',
    deadline: 'До начала sprint',
    priority: 'medium',
    needsReport: true,
    needsNextSteps: true,
  },
  {
    id: 'complex_stage_readiness',
    title: 'Проверить готовность к Stage',
    objective:
      'Проверить готовность AI Company mobile demo к Stage: demo scenario, Ollama relay, Runtime, reports.',
    context: 'Stage demo через iPhone LAN + Mac Vite dev; Ollama на 127.0.0.1 с relay.',
    expectedResult:
      'Stage readiness checklist: green/yellow/red по каждому блоку demo + blockers Owner.',
    constraints: 'Manual QA steps должны быть воспроизводимы с iPhone.',
    forbidden: 'Не открывать Ollama 0.0.0.0; не требовать ручных правок на сервере.',
    deadline: 'Перед demo',
    priority: 'critical',
    needsReport: true,
    needsNextSteps: true,
  },
  {
    id: 'complex_runtime_errors',
    title: 'Проанализировать ошибки Runtime',
    objective:
      'Проанализировать последние Runtime / Worker Loop failures: diagnostics, Ollama, model, network.',
    context: '108D failure diagnostics в loop snapshot; LAN relay 108E.',
    expectedResult:
      'Root cause summary, частые паттерны ошибок, fix recommendations и QA checklist.',
    constraints: 'Использовать failureDiagnostics и pipeline detail; без fake progress.',
    forbidden: 'Не менять Runtime orchestration без отдельной задачи.',
    deadline: 'Срочно при active failures',
    priority: 'high',
    needsReport: true,
    needsNextSteps: true,
  },
  {
    id: 'complex_morning_report',
    title: 'Составить утренний отчёт',
    objective:
      'Составить утренний отчёт Owner: состояние MAX, очередь, вчерашние результаты, решения, риски.',
    context: 'Morning report journal + operating day + work queue localStorage.',
    expectedResult:
      'Утренний brief для Owner: summary, completed/blocked, decisions needed, next actions.',
    constraints: 'Read-only snapshot из domain engines; без backend.',
    forbidden: 'Не выдумывать метрики без данных в localStorage.',
    deadline: 'Утро текущего operating day',
    priority: 'medium',
    needsReport: true,
    needsNextSteps: true,
  },
]

export function isMobileComplexTaskTemplateId(value: string): value is MobileComplexTaskTemplateId {
  return MOBILE_COMPLEX_TASK_TEMPLATES.some((item) => item.id === value)
}

export function findMobileComplexTaskTemplate(
  id: MobileComplexTaskTemplateId,
): MobileComplexTaskTemplate | undefined {
  return MOBILE_COMPLEX_TASK_TEMPLATES.find((item) => item.id === id)
}

export function isMobileComplexTaskFormValid(form: MobileComplexTaskFormState): boolean {
  return form.title.trim().length > 0 && form.objective.trim().length > 0
}

function section(label: string, value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return `## ${label}\n${trimmed}`
}

export function buildTaskTextFromComplexForm(form: MobileComplexTaskFormState): string {
  const parts = [
    section('Что нужно сделать', form.objective),
    section('Контекст', form.context),
    section('Ожидаемый результат', form.expectedResult),
    section('Ограничения', form.constraints),
    section('Что нельзя делать', form.forbidden),
    section('Срок / срочность', form.deadline),
  ].filter((item): item is string => Boolean(item))

  const deliverables = [
    `- Подготовить отчёт: ${form.needsReport ? 'да' : 'нет'}`,
    `- Предложить следующие шаги: ${form.needsNextSteps ? 'да' : 'нет'}`,
  ].join('\n')

  parts.push(`## Deliverables\n${deliverables}`)

  return parts.join('\n\n').trim()
}

export function buildStructuredPayloadFromComplexForm(
  form: MobileComplexTaskFormState,
): WorkItemStructuredPayload {
  return {
    version: WORK_ITEM_STRUCTURED_PAYLOAD_VERSION,
    mode: 'complex',
    templateId: form.templateId,
    objective: form.objective.trim() || null,
    context: form.context.trim() || null,
    expectedResult: form.expectedResult.trim() || null,
    constraints: form.constraints.trim() || null,
    forbidden: form.forbidden.trim() || null,
    deadline: form.deadline.trim() || null,
    needsReport: form.needsReport,
    needsNextSteps: form.needsNextSteps,
  }
}

export function buildStructuredPayloadFromQuickForm(input: {
  expectedOutput: string
  templateId: string | null
}): WorkItemStructuredPayload {
  return {
    version: WORK_ITEM_STRUCTURED_PAYLOAD_VERSION,
    mode: 'quick',
    templateId: input.templateId,
    expectedResult: input.expectedOutput.trim() || null,
  }
}
