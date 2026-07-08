# AI-COMPANY-107I — Mobile Run Next Confirmation Sheet

## Scope

Safe mobile confirmation before MAX Worker Loop runs the next queue item.

## Flow

1. Owner taps **Запустить следующую** on `/mobile/employees/ag-max`
2. Bottom sheet opens with task preview + what will happen + warning
3. **Отмена** closes sheet — no Worker Loop start
4. **Запустить** calls existing `runMaxEmployeeWorkQueueNextItem()`
5. Running phase disables duplicate start; card shows **MAX выполняет задачу…**
6. Success → links to Reports / MAX; Error → message + Ollama hint when model-related

## Files

- `src/mobile/components/MobileRunNextConfirmationSheet.tsx`
- `src/mobile/components/MobileWorkQueueCard.tsx`
- `src/mobile/hooks/useMobileEmployeeMax.ts`
- `src/mobile/pages/MobileEmployeePage.tsx`
- `src/i18n/mobile/ru.ts`, `en.ts` — `maxControl.runNextConfirm`
- `src/styles/mobile.css` — `acMobileRunNextSheet*`

## Manual check

```bash
npm --prefix apps/ai-company run build
```

On `/mobile/employees/ag-max`: create task → Run next → confirm sheet → cancel / confirm / duplicate disabled.

## Constraints

No Worker Loop, Runtime, or backend changes. No auto-run without explicit confirm.
