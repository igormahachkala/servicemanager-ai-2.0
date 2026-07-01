# Runtime Report Quality V1

## Goal

Runtime reports must read like a **Senior Engineer handoff**, not a generic LLM reply.

## Required sections (Russian)

After every Run, the employee response and stored report include:

```
━━━━━━━━━━━━
Краткий итог
Что проверено
Что найдено
Риски
Рекомендации
Следующий шаг
Требуется решение Owner
━━━━━━━━━━━━
```

## Severity

Each risk line uses one of:

- **Critical**
- **High**
- **Medium**
- **Low**

When no critical/high issues exist, Risks must include:

> Критических проблем не обнаружено.

## Implementation

| Layer | File | Role |
|-------|------|------|
| Prompt | `runtimeEmployeePersona.ts` | Persona structure aligned to report sections |
| Prompt | `runtimePromptBuilder.ts` | Injects `buildRuntimeReportOutputInstructions()` |
| Post-run | `runtimeReport/runtimeReportQuality.ts` | Parses model output, builds `Report.runtimeBody` |
| Orchestrator | `runtimeOrchestrator.ts` | `createRuntimeReport` → `buildRuntimeReportFromRun` |
| UI | `RuntimeReportView.tsx` | Structured report page with severity badges |
| Storage | `reportStorage.ts` | Persists optional `runtimeBody` |

## Generic response guard

If the model reply is empty or matches generic LLM patterns, the builder produces a fallback Senior Engineer report with runtime metadata and a low-severity note to retry with Prompt Preview.

## Backward compatibility

Legacy `Report` fields (`summary`, `findings`, `risks`, `recommendations`) are still populated from `runtimeBody` so Memory Evolution and search keep working.
