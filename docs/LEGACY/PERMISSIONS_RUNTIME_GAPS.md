# Permissions Runtime Gaps

## Scope checked

Reviewed frontend Management Console runtime logic in:

- `web/src/ui/Shell.tsx`
- `web/src/router.tsx`
- `web/src/views/EmployeesPage.tsx`
- `web/src/views/SettingsPage.tsx`
- `web/src/views/TicketPage.tsx`
- `web/src/views/AnalyticsPage.tsx`
- `web/src/views/BoardPage.tsx`
- `web/src/pages/platform/PermissionsPage.tsx`
- related helpers in `web/src/lib/*`
- supporting employee components used by Management Console

This document lists only confirmed runtime gaps where the frontend still relies on generic `ADMIN` logic even though runtime behavior must differ between client-company admin and provider-company admin.

## Found runtime gaps

### 1. Ticket assignment UI is still opened for any `ADMIN`

- File: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:26)
- Line / component:
  - `MANAGEMENT_ROLES` at lines `26-31`
  - `canAssign` at lines `373-374`
  - assignment panel render at lines `1539-1646`
- Why this is a problem:
  - frontend treats every `ADMIN` as assignment-capable
  - backend PBAC split says `ADMIN + CLIENT` must not have `TICKETS_ASSIGN`, while `ADMIN + PROVIDER` does have it
  - result: client-company admin still sees "Исполнитель", "Назначить техника", assignment candidates and reassignment controls
- Risk:
  - false affordance on a critical operational workflow
  - user can get hard `403` on a live ticket path after interacting with a control the UI explicitly exposed
  - this is a high-confidence trust break because assignment is one of the main actions in the console
- Recommended fix:
  - stop deriving assignment capability from raw role arrays in `TicketPage`
  - gate assignment UI by a runtime capability that distinguishes company type, for example from `me + company.type` or from a dedicated frontend permission/capability response
  - minimum acceptable fix: derive `ADMIN` assignment eligibility from company type and allow it only for provider companies
- Priority: `P0`

### 2. Ticket status-changing actions are still opened for any `ADMIN`

- File: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:28)
- Line / component:
  - `STATUS_CHANGE_ROLES` at lines `28-31`
  - `canChangeStatus` at lines `374-377`
  - action bar / status buttons at lines `1182-1305`
  - non-technician comment/status block at lines `1662-1680`
- Why this is a problem:
  - frontend treats every `ADMIN` as status-change capable
  - backend PBAC split says `ADMIN + CLIENT` must not have `TICKETS_STATUS_CHANGE`, while `ADMIN + PROVIDER` does have it
  - result: client-company admin can still see and attempt operational actions like:
    - `В работу`
    - `Отправить на приёмку`
    - `Отменить`
    - related status-driving comment flow
- Risk:
  - client-side management users are shown provider-side operational controls they are not allowed to execute
  - this affects the main lifecycle transitions of a ticket and can produce repeated `403` failures in core workflows
  - because these actions are prominent, this is a production-facing UX and permission correctness issue
- Recommended fix:
  - remove raw `ADMIN` status capability from local role arrays
  - resolve status-change capability from company-type-aware runtime logic
  - minimum acceptable fix: only treat `ADMIN` as status-change capable when tenant company type is `PROVIDER`
- Priority: `P0`

## Checked and not confirmed as ADMIN split runtime gaps

The following areas were checked, but no confirmed `CLIENT_ADMIN / PROVIDER_ADMIN` runtime gap was found in the current code:

- `Shell`
- `router`
- `Employees`
- `Settings`
- `Analytics`
- `Board`
- `Permissions`
- `resolveAdminProfile` / role display helpers

Notes:

- Some of these areas still contain generic role checks or broader permission drift risks.
- They are intentionally not listed here, because this audit is limited to confirmed runtime gaps specifically caused by unsplit generic `ADMIN` logic.
