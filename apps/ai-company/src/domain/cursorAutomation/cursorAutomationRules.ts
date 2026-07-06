/**
 * Ссылки на .cursor/rules — статический каталог для handoff prompt (V1).
 * Не читаем файлы в runtime; Owner обновляет список при изменении rules.
 */

export type CursorRuleRef = {
  id: string
  path: string
  summary: string
}

export const CURSOR_AUTOMATION_RULE_REFS: CursorRuleRef[] = [
  {
    id: '00-workflow',
    path: '.cursor/rules/00-workflow.mdc',
    summary:
      'Русские ответы; локальный код only; анализ → plan → files → changes → checks; backend build → frontend build; multi-tenant companyId.',
  },
  {
    id: '10-architecture',
    path: '.cursor/rules/10-architecture.mdc',
    summary:
      'ticket owner = CLIENT; provider через relationship; technician через binding; Controller → Guard → Policy → Service → DB; не ломать impersonation/inspection.',
  },
  {
    id: '20-file-size',
    path: '.cursor/rules/20-file-size.mdc',
    summary: 'Файлы 300–500 строк идеал; >500 декомпозиция; >800 запрещено; не смешивать refactor и behavior.',
  },
  {
    id: 'ai-company-core',
    path: '.cursor/rules/ai-company-core.mdc',
    summary: 'Scope apps/ai-company; Claude/Codex = tools не employees; без cloud LLM API в Runtime V1.',
  },
  {
    id: 'graphify',
    path: '.cursor/rules/graphify.mdc',
    summary: 'Перед explore — graphify query; после изменений — graphify update.',
  },
]

export function formatCursorRulesForPrompt(refs: CursorRuleRef[] = CURSOR_AUTOMATION_RULE_REFS): string {
  return refs.map((item) => `- **${item.path}** — ${item.summary}`).join('\n')
}
