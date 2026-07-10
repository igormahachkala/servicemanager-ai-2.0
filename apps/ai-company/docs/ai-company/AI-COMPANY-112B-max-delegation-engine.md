# AI-COMPANY-112B — MAX Delegation Engine V1

## Goal

MAX принимает решение, **кому поручить работу**. Decision layer only — задачи не запускаются.

**Инварианты:**

- MAX (`ag-max`) — decider
- Builder / Atlas / Sentinel — digital employees (не tools)
- Без Tool Dispatcher, Runtime, Worker Loop

## Domain

`apps/ai-company/src/domain/delegationEngine/`

| File | Role |
|------|------|
| `delegationEngineTypes.ts` | Models + input types |
| `delegationEngineCatalog.ts` | Declarative delegation rules |
| `delegationEngineExplain.ts` | Owner explainability |
| `delegationEngineEvaluate.ts` | `evaluateDelegation()` |
| `index.ts` | Public exports |

## Models

| Model | Purpose |
|-------|---------|
| `DelegationDecision` | Recommended employee + confidence + reason + explainability |
| `DelegationReason` | Code, headline, summary, matched signals |
| `DelegationCandidate` | Scored roster entry with rank |
| `DelegationPlan` | Full evaluation snapshot (`executionEnabled: false`) |

## Delegation rules (V1)

| Task signal | → Employee |
|-------------|------------|
| UI redesign, UX, screens, Figma | **Builder** (`ag-builder`, placeholder) |
| Architecture, ADR, domain invariants | **Atlas** (`ag-cto`) |
| Bug investigation, regression, QA | **Sentinel** (`ag-qa`, placeholder) |
| Unknown / low score | **MAX** (`ag-max`) |

Boosts from **Conversation Context** and **Working Memory** (111A) when chat/memory mentions employee or domain keywords.

## API

```typescript
import { evaluateDelegation } from '../domain/delegationEngine'

const plan = evaluateDelegation({
  task: {
    title: 'UI redesign mobile history cards',
    taskText: 'Переработать карточки истории задач на mobile',
  },
  conversationContext,
  workingMemory,
})

// plan.decision.recommendedCodename → "Builder"
// plan.decision.confidence → 0.78
// plan.decision.explainability.ownerExplanation → "Почему MAX выбрал Builder: …"
```

## Explainability

Owner видит:

- `ownerExplanation` — полное предложение («Почему MAX выбрал Builder»)
- `rationale` — bullets для inspector
- `alternatives` — кого ещё рассматривали и почему не выбрали
- `matchedTaskSignals`, `conversationHints`, `workingMemoryHints`

Helper: `summarizeDelegationPlanForOwner(plan)`.

## V2 backlog

- Wire into MAX Chat / Work Queue UI card
- Persist delegation plans (localStorage)
- Employee availability from presence / operating day
- Owner override + feedback loop
- Activate Builder as real employee id
