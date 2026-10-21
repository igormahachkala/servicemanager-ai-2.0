# T07 Review: TicketPage panel extraction

Reviewed commit: `9f81dc5` (`refactor(ticket): extract ticket card v2 panels`)

## Scope checked

- business logic in `web/src/views/TicketPage.tsx`
- extracted panels in `web/src/components/ticket-card-v2/*`
- chat/comments wiring
- attachments/photos wiring
- mobile `/m` impact
- permissions/status/actions
- dependency impact

## Confirmed findings

### 1. Status-action gating changed for `AWAITING_ACCEPTANCE`

- File: `web/src/views/TicketPage.tsx:1150`
- File: `web/src/components/ticket-card-v2/TicketActionsPanel.tsx:156`
- Problem: after extraction the parent passes `canChangeStatus={canChangeStatus && ticket.status !== 'AWAITING_ACCEPTANCE'}` into the panel. Before extraction the page rendered the non-technician actions block for `canChangeStatus` and applied `AWAITING_ACCEPTANCE` checks only to specific buttons. That means the extracted version suppresses the whole status-actions block for non-technicians when the ticket is in `AWAITING_ACCEPTANCE`.
- Why it matters: this is a real business-logic drift, not just UI movement. It can hide valid actions such as cancel or any other transition still allowed by `canTransitionTo(...)`.
- Acceptance risk: high. This directly changes runtime behavior around ticket lifecycle actions.
- Recommended fix: restore the previous contract. Pass raw `canChangeStatus` into the panel and keep per-button guards inside the panel exactly as they were in `TicketPage`.

### 2. Child-work toggle lost pending-state protection

- File: `web/src/components/ticket-card-v2/TicketActionsPanel.tsx:176`
- Problem: the "Создать дочернюю / скрыть форму" toggle is now hardcoded with `disabled={false}`. Before extraction in `TicketPage` it was disabled while `createChildM.isPending`.
- Why it matters: extraction changed runtime behavior during mutation. Users can reopen/close the child form while the create request is pending.
- Acceptance risk: medium. This can produce flaky UI state and repeated interaction during an in-flight child-ticket creation.
- Recommended fix: pass the original pending flag into the extracted panel and restore `disabled={createChildM.isPending}`.

## No regression confirmed in reviewed areas

### Chat / comments

- `web/src/components/ticket-page/TicketChatPanel.tsx` was not changed by the reviewed commit.
- Comment list, comment form, `messages`, `canSend`, and `onSend` wiring in `TicketPage` stayed on the same code path.
- No confirmed regression from this extraction diff.

### Attachments / photos

- `web/src/views/ticket-page/TicketAttachments.tsx` was not changed by the reviewed commit.
- Upload/delete handlers in `TicketPage` remain on the same mutations and state.
- No confirmed regression from this extraction diff.

### Mobile `/m`

- `web/src/mobile/MobileTicketPage.tsx` was not changed.
- `web/src/router.tsx` was not changed.
- No confirmed `/m` impact from this extraction diff.

### Dependencies

- No new package dependency was introduced.
- The extraction added only local imports from `web/src/components/ticket-card-v2/*`.

## Non-blocking drift worth noting

### Context panel no longer matches previous SLA/problem-context output

- File: `web/src/components/ticket-card-v2/TicketContextPanel.tsx`
- The extracted panel simplified SLA display to `Нарушен / В норме / Не задан` and dropped the previous `В риске` state derived from `slaState.isAtRisk`.
- The previous "Дополнительно" block with `problemCategory.instructions` is also no longer shown; instead the panel now shows creation date.
- This looks like UI/information loss rather than core action logic, but it is still a visible functional drift and should be treated consciously, not as a neutral extraction.

### Summary panel changed presentation

- File: `web/src/components/ticket-card-v2/TicketSummaryPanel.tsx`
- The previous compact summary included urgency, `SlaSignal`, and due-date context inline. After extraction that information is redistributed or removed from the first panel.
- This is not a confirmed business-logic break, but it is a UX change and should be validated against expected desktop acceptance.

## Conclusion

The reviewed extraction is not logic-neutral yet. Two runtime behavior changes are confirmed:

1. non-technician status actions are over-restricted for `AWAITING_ACCEPTANCE`;
2. child-work toggle lost its pending-state disable guard.

Chat/comments, attachments/photos, mobile `/m`, router, and external dependencies were not directly affected by this commit, and no confirmed regression was found there from the current diff alone.
