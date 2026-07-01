import type { OutputLanguage } from './runtimeOutputPolicy'

type EmployeePersonaConfig = {
  roleLine: string
  styleFocus: string[]
}

const PERSONA_BY_EMPLOYEE: Record<string, EmployeePersonaConfig> = {
  'ag-cto': {
    roleLine: 'AI CTO / Architect',
    styleFocus: [
      'архитектура, границы системы и инварианты',
      'риски, trade-offs и системное мышление',
      'решения для Owner с ясными альтернативами',
      'согласованность с multi-tenant и delivery process',
    ],
  },
  'ag-max': {
    roleLine: 'Senior Developer',
    styleFocus: [
      'техническая конкретика: файлы, модули, API, стек',
      'код, баги, MVP scope и practical fixes',
      'короткие actionable recommendations',
      'что оставить в AI Company vs что передать Codex',
    ],
  },
  'ag-qa': {
    roleLine: 'QA Engineer',
    styleFocus: [
      'сценарии проверки и acceptance criteria',
      'риски регрессии и blockers',
      'воспроизводимые шаги и pass/fail gates',
      'demo readiness и gaps перед релизом',
    ],
  },
  'ag-devops': {
    roleLine: 'DevOps Engineer',
    styleFocus: [
      'окружение, деплой, PM2 и health checks',
      'стабильность, rollback и readiness',
      'production vs local paths',
      'мониторинг и verification после деплоя',
    ],
  },
}

const AI_PHOTO_LAB_PROJECT_ID = 'project-ai-photo-lab'

const AI_PHOTO_LAB_HINTS_RU = [
  'Репозиторий: ~/projects/ai-photo-lab — код меняет Codex, не apps/ai-company',
  'Production: /opt/ai-photo-lab на 194.67.92.12, домен vitrina.sma-assistants.ru',
  'MVP flows: upload, analysis, zones, chat, history, mobile',
  'Health check: https://vitrina.sma-assistants.ru/health',
]

const AI_PHOTO_LAB_HINTS_EN = [
  'Repo: ~/projects/ai-photo-lab — code changes via Codex, not apps/ai-company',
  'Production: /opt/ai-photo-lab on 194.67.92.12, domain vitrina.sma-assistants.ru',
  'MVP flows: upload, analysis, zones, chat, history, mobile',
  'Health check: https://vitrina.sma-assistants.ru/health',
]

function resolveProjectHints(projectId: string | null | undefined, language: OutputLanguage): string[] {
  if (projectId !== AI_PHOTO_LAB_PROJECT_ID && !projectId?.includes('ai-photo-lab')) {
    return []
  }
  return language === 'en' ? AI_PHOTO_LAB_HINTS_EN : AI_PHOTO_LAB_HINTS_RU
}

function resolvePersonaConfig(employeeId: string, role: string): EmployeePersonaConfig {
  return (
    PERSONA_BY_EMPLOYEE[employeeId] ?? {
      roleLine: role,
      styleFocus: ['прикладные рекомендации по задаче Owner'],
    }
  )
}

function buildRussianPersona(
  headerLine: string,
  styleFocus: string[],
  projectLabel: string | null,
  projectHints: string[],
): string {
  return [
    `Роль в ответе: ${headerLine}`,
    '',
    'Стиль и фокус:',
    ...styleFocus.map((item) => `- ${item}`),
    '',
    projectLabel ? `Контекст проекта: ${projectLabel}` : null,
    projectHints.length
      ? ['Конкретика по проекту:', ...projectHints.map((item) => `- ${item}`)].join('\n')
      : null,
    '',
    'Обязательная структура ответа (на русском, как отчёт Senior Engineer):',
    `1. Первая строка — строго: «${headerLine}»`,
    '2. Краткий итог — 2–4 предложения по сути',
    '3. Что проверено — конкретные артефакты, файлы, сценарии, команды',
    '4. Что найдено — факты, баги, gaps без воды',
    '5. Риски — каждый пункт с severity: Critical / High / Medium / Low',
    '6. Рекомендации — practical шаги с приоритетами',
    '7. Следующий шаг — один конкретный actionable шаг',
    '8. Требуется решение Owner — да/нет и что именно решить',
    '',
    'Если критических проблем нет — в «Риски» напиши: «Критических проблем не обнаружено.»',
    'Запрещено: generic GPT tone, «конечно», «буду рад помочь», Summary/Risks/Next Actions и прочие англоязычные заголовки.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildEnglishPersona(
  headerLine: string,
  styleFocus: string[],
  projectLabel: string | null,
  projectHints: string[],
): string {
  return [
    `Answer as: ${headerLine}`,
    '',
    'Style and focus:',
    ...styleFocus.map((item) => `- ${item}`),
    '',
    projectLabel ? `Project context: ${projectLabel}` : null,
    projectHints.length
      ? ['Project specifics:', ...projectHints.map((item) => `- ${item}`)].join('\n')
      : null,
    '',
    'Required answer structure (Senior Engineer report):',
    `1. First line — exactly: "${headerLine}"`,
    '2. Brief summary — 2–4 sentences',
    '3. What was checked — concrete artifacts, files, scenarios',
    '4. What was found — facts, bugs, gaps',
    '5. Risks — each line prefixed with Critical / High / Medium / Low',
    '6. Recommendations — practical steps with priorities',
    '7. Next step — one concrete actionable step',
    '8. Owner decision required — yes/no and what to decide',
    '',
    'If no critical issues — write in Risks: «Критических проблем не обнаружено.»',
    'Avoid generic LLM tone and filler phrases.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Builds the employee persona section injected into runtime prompts. */
export function buildEmployeePersonaSection(input: {
  employeeId: string
  codename: string
  role: string
  language: OutputLanguage
  projectLabel: string | null
  projectId?: string | null
}): string {
  const config = resolvePersonaConfig(input.employeeId, input.role)
  const headerLine = `${input.codename} — ${config.roleLine}`
  const projectIdFromLabel = input.projectLabel?.match(/\(([^)]+)\)$/)?.[1] ?? null
  const projectId = input.projectId ?? projectIdFromLabel
  const projectHints = resolveProjectHints(projectId, input.language)

  if (input.language === 'en') {
    return buildEnglishPersona(headerLine, config.styleFocus, input.projectLabel, projectHints)
  }

  return buildRussianPersona(headerLine, config.styleFocus, input.projectLabel, projectHints)
}
