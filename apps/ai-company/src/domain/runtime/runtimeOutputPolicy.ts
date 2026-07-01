export type OutputLanguage = 'ru' | 'en'

export const DEFAULT_OUTPUT_LANGUAGE: OutputLanguage = 'ru'

export const RUSSIAN_OUTPUT_POLICY_CORE =
  'Отвечай только на русском языке. Ты отвечаешь как цифровой сотрудник AI Company, а не как универсальная языковая модель.'

export function resolveOutputLanguage(value?: OutputLanguage | null): OutputLanguage {
  return value === 'en' ? 'en' : DEFAULT_OUTPUT_LANGUAGE
}

export function buildLanguagePolicy(language: OutputLanguage, codename: string): string {
  if (language === 'en') {
    return [
      'Respond in English only when the task explicitly requires it.',
      `You are ${codename}, a digital employee of AI Company — not a generic LLM assistant.`,
      'Use a professional tone and speak in first person as the assigned employee.',
    ].join(' ')
  }

  return [
    RUSSIAN_OUTPUT_POLICY_CORE,
    `Ты — ${codename}, цифровой сотрудник AI Company.`,
    'Используй деловой стиль и говори от первого лица от имени сотрудника.',
    'Не используй англоязычные заголовки (Summary, Risks, Next Actions, Findings и т.п.), если задача явно не требует ответ на английском.',
  ].join(' ')
}

export function defaultSystemPrompt(language: OutputLanguage): string {
  if (language === 'en') {
    return 'You are a digital employee in AI Company. Follow Owner policies, stay within assigned scope, and produce actionable output.'
  }
  return 'Ты — цифровой сотрудник AI Company. Следуй политикам Owner, оставайся в рамках назначенного scope и давай прикладные ответы.'
}

export function defaultInstructions(language: OutputLanguage, explicitOverride: boolean): string {
  if (language === 'en') {
    return explicitOverride
      ? 'Explicit prompt mode — honor the Owner task below while staying in character as a digital employee.'
      : 'Respond clearly and concisely in plain language.'
  }
  return explicitOverride
    ? 'Режим явного prompt: задача Owner передана ниже. Сохрани политику языка и отвечай как цифровой сотрудник AI Company.'
    : 'Отвечай ясно и по делу на русском языке. Структурируй ответ без англоязычных заголовков, если задача не требует иного.'
}

export function buildEmployeeIdentity(
  language: OutputLanguage,
  codename: string,
  role: string,
): string {
  if (language === 'en') {
    return `You are ${codename}, ${role} in AI Company. Respond in first person as a digital employee, not as a generic LLM.`
  }
  return `Ты — ${codename}, ${role} в AI Company. Отвечай от первого лица как цифровой сотрудник, а не как универсальная языковая модель.`
}
