# AI-COMPANY-112D — Delegation Plan Persistence & Owner Approval V1

## Goal

Превратить результат MAX Delegation Engine в **сохраняемый план** с явным решением Owner.

MAX выбирает сотрудника и объясняет выбор — **работа не передаётся без approve**.

## Domain

`apps/ai-company/src/domain/delegationPlan/`

| File | Role |
|------|------|
| `delegationPlanTypes.ts` | `DelegationPlanRecord`, statuses |
| `delegationPlanStorage.ts` | localStorage API |
| `delegationPlanFromEvaluation.ts` | `createDelegationPlanFromEvaluation()` |
| `delegationPlanOwnerExplain.ts` | Owner-facing text (no raw score) |
| `index.ts` | Public exports |

Storage key: `ai-company-delegation-plans`  
Sync event: `ai-company-delegation-plans-sync`

## Statuses

`proposed` → `awaiting_owner` → `approved` | `rejected` → (V2) `delegated`

Also: `cancelled`, `failed`

## Owner approval rule (V1)

Если `recommendedEmployeeId !== ag-max` → `awaiting_owner`, Owner must approve/reject.

Approve **не создаёт** WorkItem и **не запускает** исполнителя.

## API

```typescript
import { evaluateDelegation } from '../delegationEngine'
import { createDelegationPlanFromEvaluation } from '../delegationPlan'

const evaluation = evaluateDelegation({ task: { title: 'UI redesign…', taskText: '…' } })
const plan = createDelegationPlanFromEvaluation({ evaluation, taskText: '…' })

approveDelegationPlan(plan.id)
rejectDelegationPlan(plan.id)
```

## Mobile

- `/mobile/decisions` — filter **Делегирование**
- Card: MAX decision, assignee, explanation, confidence (secondary), alternatives, risk
- Actions: Approve / Reject / Open employee / Open source task

## Timeline (Chat Timeline V2)

Events from plan `history`:

- `delegation_proposed`
- `delegation_approved`
- `delegation_rejected`

## Manual QA

```javascript
import { evaluateDelegation } from './src/domain/delegationEngine'
import { createDelegationPlanFromEvaluation } from './src/domain/delegationPlan'

const plan = createDelegationPlanFromEvaluation({
  evaluation: evaluateDelegation({
    task: { title: 'UI redesign mobile cards', taskText: 'Переработать карточки mobile UI' },
  }),
})
// → /mobile/decisions → approve → status approved, Builder queue unchanged
```

## V2 backlog

- `markDelegationPlanDelegated()` + WorkItem creation
- Desktop Owner inbox
- MAX Chat auto-proposal on delegation intent
