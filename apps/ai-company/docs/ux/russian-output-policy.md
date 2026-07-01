# Russian Employee Output Policy

Default language for AI Company runtime output is **Russian (`ru`)**.

## Policy core

Every runtime prompt includes:

```
Отвечай только на русском языке. Ты отвечаешь как цифровой сотрудник AI Company, а не как универсальная языковая модель.
```

Plus:

- деловой стиль
- ответ от первого лица от имени сотрудника
- без англоязычных заголовков (Summary, Risks, Next Actions), если задача не требует English

## Implementation

| Module | Role |
|--------|------|
| `runtimeOutputPolicy.ts` | `DEFAULT_OUTPUT_LANGUAGE`, `buildLanguagePolicy()`, identity/instruction helpers |
| `runtimeEmployeePersona.ts` | MAX/Atlas role-specific persona and AI Photo Lab project hints |
| `runtimePromptBuilder.ts` | Injects persona, `languagePolicy`, wraps explicit Run Task prompts |
| `runtimeOrchestrator.ts` | `RuntimeRunRequest.outputLanguage` (default `ru`) |
| `taskRunnerTemplates.ts` | Run Task owner prompt template in Russian |
| `PromptPreviewPanel.tsx` | Shows output language + Language Policy section |

## Explicit prompt mode (Run Task)

Owner task text is **not** sent raw. It is wrapped:

1. Language policy
2. Employee identity
3. Owner task body
4. Output instructions

## Override

Set `outputLanguage: 'en'` on `RuntimeRunRequest` only when the task explicitly requires English output.
