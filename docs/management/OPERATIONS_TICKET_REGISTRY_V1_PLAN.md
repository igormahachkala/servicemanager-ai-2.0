# Operations Ticket Registry V1 Plan

Status: technical implementation plan. This document does not change production
code.

Goal: replace Kanban as the only primary ticket workflow with a compact desktop
ticket registry for dispatch work. Kanban remains available as a secondary view
mode using the same source data and permissions.

Non-goals:

- No backend implementation in this planning task.
- No router/navigation changes in this planning task.
- No Ticket Drawer implementation in Registry V1.
- No mobile changes.
- No Stage or Production changes.

## 1. Current State

### Current Routes

- `/board` renders `BoardPage`.
- `/tickets` also renders `BoardPage`.
- `/tickets/new` renders `CreateTicketPage`.
- `/tickets/:id` renders `TicketPage`.
- There is no separate `TicketsPage.tsx` in the current desktop code.

### Current Data Loading

The board uses `api.board()` against `/tickets/board`.

Current request parameters:

- `take`.
- `linkedClientCompanyId`.
- `companyId`.
- `locationId`.
- `equipmentId`.
- `status`.
- `includeArchived`.

The response is `BoardResponse`:

- `columns[]`.
- `columns[].status`.
- `columns[].total`.
- `columns[].sla.breached`.
- `columns[].sla.atRisk`.
- `columns[].cards[]`.
- `meta.totalTickets`.
- `meta.atRiskThresholdMinutes`.
- `meta.limitedToLast`.
- `meta.scopeCompanyId`.
- `meta.visibilityMode`.

The board query key includes the same scope and filter state:

- `take`.
- observer company.
- linked client company.
- selected location.
- selected equipment.
- selected status.
- include archived.

### Current Ticket Data Available in Board Cards

`TicketCard` already includes enough data for Registry V1 read-only rows:

- `id`.
- `ticketNumber`.
- `companyId`.
- `title`.
- `status`.
- `urgency`.
- `priority`.
- `createdAt`.
- `slaDueAt`.
- `slaBreached`.
- `isChild`.
- `pointName`.
- `location.id`.
- `location.name`.
- `location.platformCode`.
- `location.externalCode`.
- `location.city`.
- `location.address`.
- `equipment.id`.
- `equipment.name`.
- `equipment.type`.
- `equipment.status`.
- `category.id`.
- `category.name`.
- `assignedTechnician.id`.
- `assignedTechnician.email`.
- `assignedTechnician.firstName`.
- `assignedTechnician.lastName`.
- `description`.
- `requesterName`.
- `createdByUserId`.
- `assignedTechnicianId`.
- `canClaimByCurrentUser`.
- `assignmentRequestedByCurrentUser`.
- `claimAvailabilityReason`.
- `attachmentPreviewUrl`.
- `imageAttachmentCount`.

Data gaps for a complete Registry:

- Company/client display name is not guaranteed on every `TicketCard`.
- Last update timestamp is not present in `TicketCard`.
- Fine-grained `availableActions` is present on ticket detail, not on board
  cards.
- Full SLA state beyond due/breached/column at-risk is limited.
- Assignment candidate details are loaded through ticket detail endpoints, not
  board rows.

V1 can start without backend changes by using the data above. Backend changes
should be deferred until there is proof that row-level company names, updatedAt,
server pagination, or server-side search are required for acceptable production
behavior.

### Current Kanban Structure

The board flattens `BoardResponse.columns` into `cardsAll` for local options and
statistics, then renders one column per ticket status.

Current Kanban card shows:

- Checkbox for selection.
- Ticket title as link.
- Compact service context.
- Urgency.
- Child-ticket tag.
- SLA breached tag.
- Technician claim markers.
- Assigned technician email or "not assigned".
- Created date.
- SLA due date.
- Technician quick actions.
- Dispatcher smart assign action for unassigned NEW tickets.
- Link to full ticket page.

### Current Filters

Current filters:

- Location.
- Equipment.
- Status.
- Include archived.
- Provider linked client context.
- Platform observer company context.
- `take`.

Current quick filters also exist through context analytics blocks by location and
equipment.

Current gaps:

- No text search in desktop board.
- No assignee filter.
- No date range filter.
- No SLA-state filter independent of status.
- No priority filter beyond visual tags.
- No saved views.
- No explicit Registry/Board mode URL state.

### Current Actions

Ticket row/card actions currently available in board flow:

- Open ticket detail.
- Create ticket.
- Technician claim.
- Technician start work.
- Technician send to acceptance.
- Dispatcher smart assign for unassigned NEW tickets.
- Bulk claim.
- Bulk move to `IN_PROGRESS`.
- Bulk move to `AWAITING_ACCEPTANCE`.
- Clear selection.

Ticket detail adds:

- Manual assignment and reassignment.
- Assignment candidates.
- Ticket status actions.
- Acceptance decision.
- Comments.
- Attachments/photos.
- Child ticket creation.
- Edit forms.

Registry V1 should reuse the current board actions where they are already safe
on cards. It should not invent new actions that are only validated on
`TicketPage`.

### Current Permission and Visibility Gates

Frontend board gates include:

- Provider board role: `ADMIN`, `MASTER`, `DISPATCHER`, `NETWORK_DIRECTOR`.
- Ticket creation: `ADMIN`, `MASTER`, `DISPATCHER`, `NETWORK_DIRECTOR`,
  `CLIENT`, `TERRITORIAL_MANAGER`, `TECHNICIAN`.
- Analytics visibility: `ADMIN`, `MASTER`, `DISPATCHER`, `NETWORK_DIRECTOR`,
  `TECHNICIAN`, `PLATFORM_ADMIN`.
- Bulk operational actions: `ADMIN`, `MASTER`, `DISPATCHER`,
  `NETWORK_DIRECTOR`, `TECHNICIAN`, excluding client tenant company mode.
- Company context read: `ADMIN`, `MASTER`, `DISPATCHER`, `NETWORK_DIRECTOR`.
- Provider linked-client selection is limited to provider board roles and
  excludes territorial manager.
- SECONDARY linked-client selection is treated as restricted for full board
  visibility.
- Platform observer mode uses `companyId`.
- Provider/client operational context uses `linkedClientCompanyId`.

Backend visibility must remain the source of truth:

- Role visibility.
- Provider/client contract context.
- PRIMARY and SECONDARY restrictions.
- User access scope and selected locations.
- Technician claim/assignment rules.
- Platform observer behavior.

Registry V1 must preserve these gates and should share the same scope object and
query keys with the current board flow.

### Current Pagination and Take Behavior

Current board state defaults to `take = 120`.

The UI allows increasing `take` up to `1000`, and it contains demo-facing text
about increasing `take` to 300. This is not suitable as a long-term product
control.

Current risks:

- Large board response can create many cards and large DOM trees.
- Local search/sort over large `take` values is acceptable for V1 only as a
  transitional step.
- Server-side pagination/search will be required when ticket volume grows.

### Current Navigation to Ticket Detail

Board cards navigate to `/tickets/:id`, preserving scope through query params:

- `companyId` for platform observer.
- `linkedClientCompanyId` for provider/client linked scope.

Board filter context is stored through `boardNavigationContext` state and
restored when returning from the ticket page.

Existing navigation context already has room for:

- location.
- equipment.
- status.
- archived.
- take.
- tab.
- chips.
- search.
- scope label.

Registry V1 should reuse and extend this existing model instead of creating a
parallel state format.

## 2. Target UX

Registry V1 should make the dispatcher queue dense, searchable, and action-ready.
The first useful object after the workspace header must be the ticket registry,
not explanatory cards or demo controls.

Required UI:

- Compact rows.
- Search.
- Filters.
- Sorting.
- Status display.
- SLA display.
- Object/location display.
- Client/company display where data exists.
- Assignee display.
- Priority/urgency display.
- Created date.
- Last updated date if available; otherwise explicitly defer until backend adds
  it to board cards.
- Quick actions.
- Multi-select.
- Bulk toolbar.
- Registry/Board switcher.
- Context preservation when opening a ticket.

Registry should be the default view for `/tickets` and may become the default
view for `/board` after product approval. In V1, avoid route behavior changes
unless implementation explicitly confirms no regression.

Kanban should remain:

- Same ticket source.
- Same filters.
- Same role behavior.
- Same quick actions where applicable.
- Secondary display mode for visual workload balancing.

## 3. Registry Columns

### Mandatory Columns for V1

1. Selection checkbox.
2. Ticket number.
3. Title.
4. Status.
5. SLA.
6. Priority/urgency.
7. Object/location.
8. Assignee.
9. Created date.
10. Actions.

### Conditionally Available Columns

- Client/company: show when the board response can provide a human-readable
  name through current data or provider linked-client context. Do not show raw
  company IDs as user-facing content.
- Equipment: show compactly below object or as an optional column.
- Category: optional for dispatcher sorting and triage.
- Attachments/photos: show as a small count/icon if useful.
- Last updated: only after backend provides an accurate row field.

### Hidden or Deferred Columns

- Raw `id`.
- Raw `companyId`.
- Raw `locationId`.
- Raw `equipmentId`.
- Raw permission or scope data.
- Full description text.
- Full requester details.
- Full assignment candidate details.

### Narrow Desktop Behavior

For narrow desktop viewport:

- Keep checkbox, number, title, status, SLA, assignee, and actions visible.
- Collapse object, equipment, and category into a second row inside the same
  compact row.
- Avoid horizontal scroll until the viewport cannot support the minimum useful
  row.
- If horizontal scroll is used, keep ticket number/title and action column
  stable where practical.

### Horizontal Scroll

Horizontal scroll is acceptable only for optional columns. It must not be needed
to identify a ticket, status, SLA, or assignee.

## 4. Filter Model

### Quick Filters

Quick filters should be one-click filters near the registry:

- New.
- Unassigned.
- In progress.
- SLA breached.
- SLA at risk.
- Awaiting acceptance.
- Urgent.
- My tickets.

These should map to existing local data first where safe.

### Advanced Filters

Advanced filters should be available in a compact filter bar or popover:

- Status.
- Assignee.
- Object/location.
- Equipment.
- Company/client.
- SLA state.
- Priority/urgency.
- Date range.
- Include archived.

### Search

Search should work locally in V1 over loaded rows:

- Ticket number.
- Title.
- Description if present.
- Company/client display label if present.
- Object/location name.
- Object city/address.
- Assignee email/name.
- Category.
- Equipment.

If search quality or volume is insufficient, add server-side search in a later
slice backed by evidence.

### Saved Views

Saved views are not implemented in V1, but the architecture must leave room for:

- View name.
- Filter model.
- Sort model.
- Visible columns.
- Registry/Board mode.
- Scope label.

The current `boardNavigationContext` already includes `tab`, `chips`, `search`,
and `scopeLabel`; Registry V1 should align with that direction.

## 5. View State

Registry V1 should maintain state through URL/query params where it affects
navigation or shareability.

Recommended query state:

- `view=registry|board`.
- `status`.
- `locationId`.
- `equipmentId`.
- `assigneeId`.
- `sla=breached|at_risk|ok`.
- `priority`.
- `q`.
- `sort`.
- `page` or `cursor` when server pagination exists.
- `take` only as an internal compatibility bridge; do not present it as a main
  user control.
- `ticketId` only when a drawer or split-view route is introduced.

Rules:

- Existing `/tickets/:id` deep links must keep working.
- Existing provider/client scope query params must keep working.
- Existing board return context must keep working.
- Registry/Board switch should not clear filters.
- Opening a ticket must preserve current filters, search, scroll, and mode.
- Closing future drawer should return to the same registry position.

## 6. Component Architecture

Proposed components for implementation:

- `OperationsWorkspace`.
- `OperationsViewSwitcher`.
- `TicketRegistry`.
- `TicketRegistryToolbar`.
- `TicketRegistryFilters`.
- `TicketRegistryTable`.
- `TicketRegistryRow`.
- `TicketBulkToolbar`.
- `TicketBoardView`.

No components are created by this document.

### Extraction from BoardPage

Candidates to extract from current `BoardPage`:

- Scope resolution and provider linked-client selection.
- Board query and context analytics query.
- Location and equipment option derivation.
- Stats derivation.
- Ticket scope builder.
- Ticket link builder.
- Board navigation context.
- Quick actions mutation.
- Bulk action state and runner.
- Empty/loading/error state rendering.
- Kanban view rendering.

### Shared Logic Between Registry and Board

Must remain shared:

- API data source.
- Query key construction.
- Provider/client/observer scope.
- Permission gates.
- Quick action mutation behavior.
- Bulk action execution.
- Selected ticket IDs.
- Navigation context.
- Status/SLA label formatting.

Do not duplicate business logic in both Registry and Board. Registry and Board
should be two views of the same Operations workspace state.

### Code Boundaries

Recommended boundary:

- Operations workspace owns state and data.
- Registry receives rows, selection, filters, sort, actions, and loading state.
- Board receives the same filtered data grouped by status or uses current
  columns directly.
- Row/card components remain presentational except for explicit action callbacks.
- Backend visibility remains authoritative.

## 7. Data and Performance

### V1 Data Strategy

Use the existing `/tickets/board` API first if performance is acceptable.

Why:

- It already applies backend visibility and scope.
- It already returns the card data needed for compact rows.
- It avoids changing backend and permissions during the first UX slice.

### Known Limits

Current `take` supports up to 1000 in UI. This is a product smell, not a stable
pagination model.

Risks:

- Loading 1000 cards and rendering both Registry and Board can be expensive.
- Client-side sort/search over 1000 rows is acceptable for V1 but not for long
  term.
- Keeping Kanban mounted while Registry is active can double render cost.

### V1 Requirements

Mandatory:

- Render only the active mode: Registry or Board.
- Keep row DOM compact.
- Avoid large ticket card markup in Registry mode.
- Avoid showing demo `take` controls in the main working area.
- Preserve loading/empty/error states.
- Preserve role visibility and backend scope.

Recommended but can be deferred if it expands scope:

- Virtualized rows.
- Server-side pagination.
- Server-side search.
- Server-side sorting.
- Saved views.

Backend changes required for later scale:

- Dedicated ticket registry endpoint with pagination/cursor.
- Search query.
- Sort field and direction.
- Assignee filter.
- SLA state filter.
- Updated timestamp.
- Client/company display fields.
- Row-level available actions if quick action model expands.

Backend changes required for Registry V1:

- None proven at this stage. V1 should start on existing API unless local
  validation shows unacceptable performance or missing mandatory data.

## 8. Permission Preservation

Registry V1 must preserve all existing access behavior.

Required preserved rules:

- Role-based desktop navigation visibility.
- Provider/client context.
- PRIMARY provider board behavior.
- SECONDARY provider restrictions.
- Platform observer `companyId` behavior.
- Client tenant behavior.
- Technician assigned and claimable visibility.
- UserAccessScope selected-location enforcement.
- Restricted-empty fail-closed behavior from Access Constructor scope model.
- Claim action visibility.
- Smart assign action visibility.
- Manual assignment remains on ticket detail until drawer work.
- Bulk action availability.
- Ticket creation availability.
- Include archived behavior.
- Context analytics visibility.

Required implementation safeguards:

- Do not filter rows in a way that widens backend visibility.
- Do not synthesize rows from another endpoint.
- Do not show actions that current card/detail permissions would reject.
- Do not bypass `ticketScope` when calling ticket actions.
- Do not expose raw tenant IDs in user-facing row columns.
- Do not regress mobile query invalidation after actions.

## 9. Delivery Slices

### Slice A - Operations Workspace and View Switcher

Goal:

- Introduce an Operations workspace wrapper around the existing board state.
- Add Registry/Board mode state.
- Keep Kanban behavior unchanged as the Board view.

Expected result:

- Build passes.
- `/board` and `/tickets` still work.
- Board remains visually and functionally equivalent.
- Mode switch is present but Registry can initially be placeholder/read-only.

Checks:

- Board loads for provider/client/platform observer.
- Filters still affect board.
- Ticket links still preserve context.
- No mobile changes.

### Slice B - Read-only Registry

Goal:

- Render compact rows from existing board cards.

Expected result:

- Registry displays ticket number, title, status, SLA, priority/urgency,
  object/location, assignee, created date, and open action.
- Board remains available as secondary mode.

Checks:

- 3 to 5 times more tickets fit on one screen than current cards.
- No new backend request.
- Empty/loading/error states work.

### Slice C - Filters, Search, Sort

Goal:

- Move operational controls above Registry and make them useful for queue work.

Expected result:

- Local search over loaded tickets.
- Quick filters.
- Advanced filters.
- Sorting by created date, SLA, priority, status, assignee.
- Registry/Board switch preserves filters.

Checks:

- Filter model does not widen backend scope.
- URL/search state can restore user context.
- No raw `take` demo control in main workflow.

### Slice D - Row Actions and Bulk Toolbar

Goal:

- Bring safe existing board actions into registry rows.

Expected result:

- Row open action.
- Technician claim/start/send-to-acceptance where currently allowed.
- Dispatcher smart assign for unassigned NEW tickets where currently allowed.
- Multi-select.
- Bulk toolbar shown only when rows are selected.

Checks:

- Bulk actions preserve current role restrictions.
- Actions invalidate the same query keys as current board actions.
- Errors use existing action error mapping.

### Slice E - Polish and Acceptance

Goal:

- Make Registry V1 ready for product review.

Expected result:

- Stable scroll behavior.
- 125% zoom works.
- Narrow desktop works.
- Empty, loading, error, no-permission, and restricted-scope states are clear.
- Kanban remains available and not broken.

Checks:

- Product acceptance with dispatcher, provider admin, client admin, technician,
  and platform observer.
- No mobile regressions.
- No unrelated navigation changes.

## 10. Acceptance Criteria

### Functionality

- `/tickets` and `/board` still load.
- Registry mode displays tickets from the existing board response.
- Board mode remains available.
- Registry/Board switch does not clear filters.
- Search works across ticket number, title, object, assignee, category, and
  available descriptive fields.
- Status, location, equipment, archived, SLA, and priority filters behave
  predictably.
- Sorting works without corrupting grouping or selection.
- Opening a ticket preserves current context.
- Returning from ticket detail restores context.

### Permissions

- Provider admin sees only allowed provider/client context.
- Client admin sees only their tenant/client tickets.
- Dispatcher sees operational scope according to backend.
- Technician sees assigned and claimable tickets according to backend.
- SECONDARY restrictions remain enforced.
- Platform observer mode remains explicit through `companyId`.
- UserAccessScope restrictions remain backend-authoritative.
- Bulk actions remain hidden or disabled for roles that cannot use them.
- No raw IDs or permission internals are exposed as business UI.

### Performance

- Registry with 120 tickets is responsive.
- Registry with 300 loaded tickets remains usable.
- Registry must not mount all Kanban cards while Registry mode is active.
- No new N+1 requests.
- No additional per-row ticket detail requests.
- If 1000 loaded tickets is not acceptable, document the evidence and move
  server-side pagination to the next backend slice.

### Scroll Behavior

- The user should not need full-page vertical scanning to work the queue.
- Filters and bulk toolbar must be near the registry.
- Bulk toolbar appears only after selection.
- Board cards should not be the first or only working object.
- Registry rows should keep stable height.

### Desktop Responsiveness

- 125% zoom remains usable.
- Narrow desktop viewport keeps identity, status, SLA, and action visible.
- Optional columns collapse before mandatory columns.
- Text does not overlap controls.
- Horizontal scroll, if present, is limited to optional columns.

### States

- Loading state is compact.
- Empty state explains the active filter/scope.
- Error state shows recovery action.
- Restricted provider/client scope is clear.
- No linked clients state is clear.
- No selected object or restricted-empty state is fail-closed and human-readable.

### Kanban Preservation

- Existing Kanban columns remain available.
- Existing card quick actions still work.
- Existing board filters still work.
- Existing context analytics filters still work or are intentionally moved into
  the workspace without losing behavior.
- Existing ticket links remain valid.

### Mobile Regression Guard

- No mobile routes changed.
- No mobile components changed.
- Board action invalidations for mobile query keys remain intact.
- Ticket APIs are not changed.

## 11. Backend Change Assessment

Registry V1 does not require backend changes if accepted with these constraints:

- Use existing `/tickets/board`.
- Use client-side search/filter/sort over loaded board cards.
- Do not show last-updated column until backend provides it.
- Do not show guaranteed client/company name unless available from current scope
  or board response.
- Keep manual assignment/reassignment in ticket detail until Ticket Drawer V1.

Backend changes should be considered after V1 only if:

- Ticket volume makes client-side loaded rows too slow.
- Product requires accurate full-dataset search.
- Product requires server-side date/SLA/assignee filtering.
- Product requires reliable last update timestamps in registry rows.
- Product requires row-level available action matrix without opening details.
