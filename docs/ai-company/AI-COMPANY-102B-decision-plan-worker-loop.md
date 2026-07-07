# AI-COMPANY-102B — Decision Plan phase in MAX Worker Loop

**Статус:** integrated (domain + UI phase)  
**Ветка:** `ai-company-flow`  
**Scope:** `apps/ai-company`

## Цель

Добавить фазу **`decision_plan`** как первую реальную фазу MAX Worker Loop V1 — до Ollama reasoning Employee Brain строит **Decision Plan**.

## Поток

```text
Owner Task
  ↓
MAX Brain (buildEmployeeBrainDecisionPlan)
  ↓
Decision Plan (+ model_selection)
  ↓
Task Runner / Ollama Reasoning
  ↓
Plan / Report / Memory & Knowledge drafts
  ↓
Tool Branch (если Decision Plan → Cursor / Owner Approval)
```

## Изменения

| Область | Файл | Суть |
|---------|------|------|
| Phases | `maxWorkerLoop.ts` | `decision_plan`, `model_selection` в domain phases |
| Engine | `maxWorkerLoopEngine.ts` | Plan до `startTaskRunner`; `decisionPlan` в record/snapshot |
| Brain bridge | `maxWorkerLoopDecisionPlan.ts` | `buildMaxWorkerLoopDecisionPlan` |
| Storage | `maxWorkerLoopStorage.ts` | persist/parse `decisionPlan`; merge legacy phases |
| Tool Branch | `cursorAutomationWorkflow.ts` | Cursor/Approval из Decision Plan, не только keywords |
| Approval gate | `maxWorkerLoopApproval.ts` | Owner Approval отражается из plan |
| UI | `maxWorkerLoopPhaseGuide.ts`, `MaxWorkerLoopPanel.tsx` | первая фаза + карточка Decision Plan |

## Worker Loop state

```typescript
MaxWorkerLoopRecord {
  decisionPlan: DecisionPlan | null  // persisted in ai-company-max-worker-loops
  phases: [..., { phase: 'decision_plan', status: 'done', ... }]
}
```

`modelMode` для Task Runner берётся из `decisionPlan.primaryModel.modelMode`.

## Constraints

- Runtime Orchestrator **не изменён**
- Decision Plan — **domain state**, не только UI
- Без shell / git / docker / Cursor API

## Checks

```bash
npm --prefix apps/ai-company run build
```

Ручная проверка: Run Task → MAX → Start → Runtime Live → MAX Worker Loop: **Decision Plan** первый шаг, карточка plan visible.

## Следующий шаг

- Persist Decision Plan в Runtime Persistence V2 port
- Rebuild Decision Plan при изменении Brain profile mid-loop
- Peer consult phase (101F) после Decision Plan при `consult_peer` signal
