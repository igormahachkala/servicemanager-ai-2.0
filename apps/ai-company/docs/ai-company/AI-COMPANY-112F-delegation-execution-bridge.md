# AI-COMPANY-112F — Delegation Execution Bridge V1

## Goal

После подтверждения Owner approved DelegationPlan реально передаёт задачу выбранному сотруднику через Employee Work Queue.

## Flow

```
Delegation Plan (approved)
  → Owner: «Передать» в MAX Chat
  → executeApprovedDelegationPlan(planId)
  → WorkItem (source=delegation, delegationPlanId)
  → markDelegationPlanDelegated (approved → delegated)
  → Builder Queue + Chat Timeline + System message
```

## API

`executeApprovedDelegationPlan(planId)` in `src/domain/delegationExecution/`

### Guards

- plan exists
- status === `approved` (или idempotent return если уже `delegated`)
- employee `availability === 'active'`
- taskTitle + taskText present
- no duplicate WorkItem for same delegationPlanId

### Idempotency

1. `plan.targetWorkItemId` → return existing WorkItem
2. `findEmployeeWorkItemByDelegationPlanId(planId)` → return + sync plan
3. Повторный «Передать» не создаёт второй WorkItem

## Manual QA

1. `/mobile/chat/ag-max` → UI task → Builder delegation
2. Согласовать → «Передать»
3. `/mobile/employees/ag-builder` → задача в очереди
4. Reload → одна задача
5. Timeline: Delegation Executed + Task Assigned
6. System: «MAX передал задачу Builder.»

## Out of scope (112F)

- Runtime / Worker Loop auto-start
- Cursor
- Tool Dispatcher
