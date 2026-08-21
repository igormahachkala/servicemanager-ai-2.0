# TicketPage Extraction Review

Target file: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:1)

## Safe blocks to extract first

### 1. Pure view helpers and presentational mini-blocks

Safe first candidates:

- `fmt`, `fmtBytes`, `statusLabel`, `urgencyLabel`, `sourceLabel`, `timelineTypeLabel`
- `StatusPill`, `SlaSignal`, `Skeleton`, `Tag`, `RecommendationBadge`, `InlineError`

Why safe:

- no API calls
- no query orchestration
- no mutation sequencing
- no permission branching beyond props

### 2. Read-only summary panels

Safe to extract into presentational components:

- "Контекст доски"
- "Что дальше"
- "Карточка заявки"
- "Кратко по заявке"
- "Дополнительно"
- child tickets read-only list
- timeline read-only panel

Relevant zone: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:1012)

Why safe:

- mostly render from already prepared `ticket`, `timelineItems`, `slaState`, `boardNavContext`
- low mutation coupling

### 3. Edit form UI shell, but not edit orchestration

The edit form markup can be extracted into a dumb component first:

- fields
- buttons
- inline loading/error presentation

Relevant zone: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:1390)

Why only partially safe:

- rendering is safe
- state hydration/reset logic should stay in `TicketPage` for the first pass

## Dangerous blocks to touch now

### 1. Scope/bootstrap block

Most dangerous area before any major decomposition:

- observer mode
- linked client mode
- provider fallback resolution by retrying `getTicket`
- `effectiveTicketScope`
- board back-link context

Relevant zone: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:208)

Why dangerous:

- this decides which tenant context every query and mutation uses
- small refactor errors here can silently redirect API calls to wrong scope
- especially risky because fallback logic depends on both query state and linked client discovery

### 2. Permission/action gating

Relevant zone: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:357)

Includes:

- `adminProfile`
- `canMutateTicket`
- `isClientTenantCompany`
- `executorActionsAllowed`
- `canAssign`
- `canChangeStatus`
- `canUploadPhoto`
- `canCreateChildTicket`
- `canClaim`
- `primaryAction`

Why dangerous:

- this is the runtime contract between frontend UX and backend permission/status model
- the file already contains split-specific logic for `ADMIN` via `resolveAdminProfile`
- extracting this carelessly can reintroduce the old generic-ADMIN bugs

### 3. Mutation layer and refresh invalidation

Relevant zone: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:478)

Includes:

- `claimM`
- `assignM`
- `selfAssignM`
- `statusM`
- `acceptanceM`
- `uploadM`
- `deleteAttachmentM`
- `updateTicketM`
- `addCommentM`
- `closeReportM`
- `createChildM`
- `refreshAll`

Why dangerous:

- mutations share error channels and success side effects
- several flows depend on precise cache invalidation ordering
- `closeReportM` and `acceptanceM` are multi-step transactions at UI level

## Where permissions / status / actions are tied together

Main coupling point:

- [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:388)

The key chain is:

1. scope and company type resolution
2. runtime capability booleans
3. backend-provided `availableStatusTransitions` and `availableActions`
4. `computePrimaryTicketAction(...)`
5. conditional rendering of:
   - technician action bar
   - non-technician action buttons
   - assignment panel
   - child work panel
   - acceptance panel

This means actions are not isolated by component boundary today. They are derived centrally and then fan out into several UI regions.

## Where acceptance can break

Highest-risk acceptance area:

- client acceptance panel: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:1142)
- technician submit-to-acceptance form: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:1325)
- acceptance mutations: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:555), [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:695)

Specific risks:

- two distinct flows share overlapping state:
  - `acceptanceComment` / `acceptanceFile`
  - `closeReportComment` / `selectedFile`
- technician completion path depends on existing work-report photo evidence
- client reject path requires comment and may upload an attachment first
- both flows reuse common status error plumbing

Practical consequence:

- do not split acceptance UI and acceptance mutations into separate commits initially
- first isolate them as a single feature slice, or leave them in place until safer parts are extracted

## Where attachments / photos can break

Highest-risk photo/attachment area:

- file validation handlers: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:871)
- generic upload/delete mutations: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:597), [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:625)
- shared file refs and state: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:204)
- attachments panels: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:1772)

Specific risks:

- `selectedFile` is reused by multiple flows
- `fileInputRef` is reused by both generic photo upload and submit-to-acceptance flow
- `operationalFileInputRef` is separate for technician quick actions
- work-report and request attachments are split by `purpose`, so wrong extraction can mix the two visual channels

Practical consequence:

- extraction of attachment rendering is safe
- extraction of upload/delete handlers and file state is not safe in the first wave

## Recommended next 5 extraction commits

### Commit 1

Extract presentational primitives and read-only summary panels from `TicketPage.tsx`.

Scope:

- helper formatters
- status/sla badges
- board context panel
- short ticket summary panels

Goal:

- reduce file size without touching behavior

### Commit 2

Extract timeline/history and child-ticket read-only sections.

Scope:

- history panel
- child tickets list
- optional additional details sections

Goal:

- move read-only render blocks out before touching mutations

### Commit 3

Extract edit form UI into a dumb component, keep state and mutation in `TicketPage`.

Scope:

- all edit fields
- edit buttons
- form-level error display

Goal:

- separate large JSX safely while keeping orchestration local

### Commit 4

Extract assignment panel as one unit, but keep `canAssign`, `assignmentCandidatesQ`, `assignM` and `assignmentDecisionQ` owned by `TicketPage`.

Scope:

- assignment JSX only
- pass prepared props and callbacks down

Goal:

- remove a large operational render block without splitting capability logic yet

### Commit 5

Extract acceptance as a single cohesive slice.

Scope:

- client acceptance panel
- technician submit-to-acceptance form
- related local UI state and handlers only if moved together

Goal:

- avoid half-splitting acceptance and breaking the state model

## Bottom line

Best first wave:

- extract read-only render blocks
- extract large JSX forms as dumb components
- keep scope resolution, capability derivation, mutations and file-state orchestration in `TicketPage` until the file is smaller

Worst first wave:

- splitting `effectiveTicketScope`
- splitting permission booleans from their callers
- splitting acceptance/photo logic across multiple commits
