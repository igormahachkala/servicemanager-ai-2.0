# Management Console Codebase Review

## Scope

Reviewed:

- `web/src/router.tsx`
- `web/src/ui/Shell.tsx`
- `web/src/lib/navigation.ts`
- `web/src/lib/managementConsoleV2Pages.ts`
- `web/src/views/v2/*`
- `web/src/views/TicketPage.tsx`
- `web/src/views/EmployeesPage.tsx`
- `web/src/views/SettingsPage.tsx`
- `web/src/pages/platform/PermissionsPage.tsx`
- `backend/src/common/permissions-*`
- `backend/src/common/permissions-matrix.ts`
- `backend/src/permissions/*`
- `backend/src/policy/tickets.policy.ts`
- `backend/src/users/users.controller.ts`
- `backend/src/tickets/tickets.controller.ts`
- `backend/prisma/schema.prisma`

## 1. How Management Console is structured now

### 1.1 Routing

Management Console is not a separate application. It is a desktop route subtree inside the main web app, mounted under authenticated root `/` through `Shell` in [web/src/router.tsx](/Users/igor/projects/sma-service/web/src/router.tsx:144).

Key observations:

- `/dashboard` is already registered, but it is still a V2 placeholder, not a real dashboard implementation: [web/src/router.tsx](/Users/igor/projects/sma-service/web/src/router.tsx:152), [web/src/lib/managementConsoleV2Pages.ts](/Users/igor/projects/sma-service/web/src/lib/managementConsoleV2Pages.ts:20)
- The real operational center is still `/board`, and `/tickets` is effectively an alias to the same board page: [web/src/router.tsx](/Users/igor/projects/sma-service/web/src/router.tsx:153)
- There is significant route duplication for legacy and renamed paths:
  - `/objects` and `/locations`
  - `/users` and `/employees`
  - `/permissions` and `/platform/permissions`
  - `/contractors` and `/service-contracts`
- V2 routes are mixed with V1 routes in the same tree instead of being isolated in a dedicated feature boundary.

### 1.2 Shell

`Shell` is the desktop composition root for the console: [web/src/ui/Shell.tsx](/Users/igor/projects/sma-service/web/src/ui/Shell.tsx:130)

It is responsible for:

- loading current user via `me`
- loading tenant company type for role labeling
- deriving active scope from URL and persisted local storage state
- websocket-driven invalidation and realtime notification hookup
- impersonation banner and exit flow
- sidebar and topbar rendering
- desktop-to-mobile bridge button
- logout and auth error redirect

This makes `Shell` both a layout component and a session/scope orchestration layer. It is an important integration point, but also a concentration of cross-cutting concerns.

### 1.3 Navigation

Navigation is configured in `web/src/lib/navigation.ts`: [web/src/lib/navigation.ts](/Users/igor/projects/sma-service/web/src/lib/navigation.ts:21)

Current model:

- navigation items are defined statically as plain arrays
- platform admins get `platformNavigation`
- all other users get `tenantNavigation`
- visibility is then filtered again inside `Shell` by `isNavItemVisible`: [web/src/ui/Shell.tsx](/Users/igor/projects/sma-service/web/src/ui/Shell.tsx:80)

This means navigation access is currently split across:

- static nav config
- role helper functions in `api.ts`
- `Shell.isNavItemVisible`
- backend roles/permissions

That split is the main source of drift risk.

### 1.4 Dashboard

Dashboard in the Management Console V2 sense does not exist yet as a functional page.

What exists:

- metadata describing intended V2 dashboard behavior: KPI, Action Center, SLA radar, assignment queues: [web/src/lib/managementConsoleV2Pages.ts](/Users/igor/projects/sma-service/web/src/lib/managementConsoleV2Pages.ts:22)
- placeholder rendering through `ManagementV2StubPage` and `V2RoutePlaceholder`

Operationally, the current home for most users is still `/board`, not `/dashboard`.

### 1.5 TicketPage

`TicketPage` is the heaviest page in the reviewed console and the closest thing to an operational kernel: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:191)

It combines:

- scope resolution for tenant, observer and linked-provider modes
- ticket fetch, timeline fetch, attachments fetch
- fallback linked-client detection for provider context
- local permission-like role gating on the frontend
- assignment actions
- claim/self-assign
- status transitions
- ticket edit form
- comments
- photo upload and deletion
- acceptance flow
- child ticket creation
- chat projection from timeline
- SLA status derivation

It is effectively a page-level workflow engine.

### 1.6 Employees

`EmployeesPage` is both a CRUD screen and a permissions/scope screen for user management: [web/src/views/EmployeesPage.tsx](/Users/igor/projects/sma-service/web/src/views/EmployeesPage.tsx:95)

It handles:

- observer mode for `PLATFORM_ADMIN`
- company type resolution
- user list search and sorting
- create/edit/delete/restore/activate/deactivate
- technician specialization management
- location bindings with separate company-scope logic
- provider linked-client selection for bindings
- defensive guards like "cannot deactivate self" and "cannot deactivate last admin"

This page is business-heavy and state-heavy, with important tenant-boundary semantics embedded directly in the view layer.

### 1.7 Settings

`SettingsPage` is intentionally thin and still mostly V1-oriented: [web/src/views/SettingsPage.tsx](/Users/igor/projects/sma-service/web/src/views/SettingsPage.tsx:8)

It currently stores only browser-local settings:

- backend URL in dev
- UI company label
- current user info
- link to company settings
- browser notifications card

This is not a real management settings module yet. It is closer to a local environment/preferences page.

### 1.8 Roles, Permissions, PBAC

The backend authorization model is a hybrid:

- coarse route gating through `RolesGuard`
- PBAC permission gating through `PermissionsGuard`
- scope and behavior decisions through service/policy layer

Key files:

- permission catalog and default matrix: [backend/src/common/permissions-matrix.ts](/Users/igor/projects/sma-service/backend/src/common/permissions-matrix.ts:34)
- guard logic: [backend/src/common/permissions.guard.ts](/Users/igor/projects/sma-service/backend/src/common/permissions.guard.ts:35)
- toggle-style per-user context flags: [backend/src/common/permissions-context.guard.ts](/Users/igor/projects/sma-service/backend/src/common/permissions-context.guard.ts:15)
- editable matrix service: [backend/src/permissions/permissions.service.ts](/Users/igor/projects/sma-service/backend/src/permissions/permissions.service.ts:81)
- matrix UI: [web/src/pages/platform/PermissionsPage.tsx](/Users/igor/projects/sma-service/web/src/pages/platform/PermissionsPage.tsx:27)

Important architectural detail:

- PBAC is keyed by `(role, companyType)` with `companyType = null` as wildcard: [backend/src/common/permissions-matrix.ts](/Users/igor/projects/sma-service/backend/src/common/permissions-matrix.ts:3)
- the frontend still contains multiple hardcoded role checks for visibility and actions
- therefore PBAC is real on the backend, but not yet the single source of truth for the console UX

## 2. Strong sides

- The backend PBAC model is materially better than plain RBAC. The split by `(role, companyType)` solves the shared `ADMIN` ambiguity in a pragmatic way: [backend/src/common/permissions-matrix.ts](/Users/igor/projects/sma-service/backend/src/common/permissions-matrix.ts:66)
- `PermissionsGuard` matches both role grants and direct user overrides, and already resolves `companyType` dynamically with a short cache: [backend/src/common/permissions.guard.ts](/Users/igor/projects/sma-service/backend/src/common/permissions.guard.ts:64)
- The permission matrix editor has a sane transactional backend with validation, idempotent add/remove semantics, lockout protection for `PLATFORM_ADMIN`, and audit event emission: [backend/src/permissions/permissions.service.ts](/Users/igor/projects/sma-service/backend/src/permissions/permissions.service.ts:108)
- `Shell` correctly centralizes scope persistence, impersonation awareness, and navigation rendering. That is the right place for those concerns, even if the file has grown too far: [web/src/ui/Shell.tsx](/Users/igor/projects/sma-service/web/src/ui/Shell.tsx:148)
- `TicketPage` contains meaningful operational protections such as observer read-only mode, client/provider distinction, acceptance restrictions, upload validation, and unified invalidation after mutations.
- `EmployeesPage` includes important safeguards against self-lockout and last-admin deactivation: [web/src/views/EmployeesPage.tsx](/Users/igor/projects/sma-service/web/src/views/EmployeesPage.tsx:457)
- V2 placeholder routing avoids dead links and 404s while product work is still in progress. That is a valid transitional pattern when used intentionally: [web/src/components/v2/V2RoutePlaceholder.tsx](/Users/igor/projects/sma-service/web/src/components/v2/V2RoutePlaceholder.tsx:18)

## 3. Weak sides

- Management Console is not a cleanly separated module. It is a mixed route tree containing legacy V1 screens, V2 placeholders, platform admin tools, tenant tools, and bridges into mobile and IT Company.
- Frontend authorization is fragmented. Visibility and action rules are duplicated across:
  - `navigation.ts`
  - `Shell.isNavItemVisible`
  - helper functions in `api.ts`
  - page-local role arrays like `EDIT_ROLES`, `STATUS_CHANGE_ROLES`, `PHOTO_ROLES`
  - backend `@Roles`
  - backend `@RequirePermission`
- `Dashboard` is product-significant in naming, but still functionally absent. That creates a mismatch between IA and reality.
- `TicketPage` is too large and too stateful. It is performing orchestration, business gating, data fetching, action handling, and UI rendering in one file.
- `EmployeesPage` has the same pattern on a smaller scale: too much view-layer knowledge of tenant mode, provider mode, binding mode, specialization constraints, and user lifecycle.
- `SettingsPage` is underpowered relative to its route prominence. It looks like a management area, but mainly edits local browser settings.
- Route aliases and renamed concepts increase mental load. The codebase currently supports both old and new naming instead of enforcing one canonical mental model.

## 4. Technical debt

### 4.1 Frontend role checks are not PBAC-driven

Examples:

- `Shell.isNavItemVisible` uses hardcoded role branching: [web/src/ui/Shell.tsx](/Users/igor/projects/sma-service/web/src/ui/Shell.tsx:80)
- `TicketPage` uses hardcoded role arrays for assignment, edit, status, photo and child work: [web/src/views/TicketPage.tsx](/Users/igor/projects/sma-service/web/src/views/TicketPage.tsx:26)
- `api.ts` still exposes role-driven capability helpers such as `isFullAdminDesktopNavRole`, `isProviderTicketAssignRole`, `isClientAcceptanceRole`: [web/src/lib/api.ts](/Users/igor/projects/sma-service/web/src/lib/api.ts:15)

This is the biggest debt item because it guarantees eventual divergence from backend truth.

### 4.2 Transitional V1/V2 architecture is leaking everywhere

- `/dashboard`, `/equipment`, `/acts`, `/assistant`, `/contractors` use V2 metadata and placeholders
- `/board` still carries the actual operation
- `/tickets` is an alias to board
- some V2 labels exist only as intent, not implementation

This is manageable as a short-lived transition, but expensive as a long-lived architecture.

### 4.3 Page-level state machines are embedded directly in components

The logic inside `TicketPage` and `EmployeesPage` should largely live in feature hooks, action services or presenter/controller layers. Right now the page files are the implementation boundary.

### 4.4 Read-only permissions APIs are not fully companyType-aware yet

The service itself documents this gap:

- `TODO(companyType-aware)` in `PermissionsService` says effective-permission read APIs still read role grants companyType-blind in some paths: [backend/src/permissions/permissions.service.ts](/Users/igor/projects/sma-service/backend/src/permissions/permissions.service.ts:208)

That is explicit technical debt in the authorization subsystem itself.

### 4.5 Scope propagation relies heavily on URL params plus localStorage

This is practical, but fragile:

- `linkedClientCompanyId`
- `companyId`
- persisted scope owner state
- fallback inference from failed ticket fetch

The mechanism works, but the number of implicit branches is high.

## 5. Risks

### 5.1 Authorization drift risk

Most serious risk.

Backend may correctly deny an action while frontend still shows it, or frontend may hide a capability that backend now allows. Because rules are duplicated, every PBAC change is also a frontend maintenance task.

### 5.2 Scope leakage risk

The console supports:

- tenant mode
- observer mode
- provider linked-client mode
- impersonation

These are all valid product requirements, but they make scope handling highly sensitive. `Shell` and `TicketPage` both depend on URL, local storage and server-returned hints. This is a good area for regressions if refactored carelessly.

### 5.3 High regression risk in Ticket workflows

`TicketPage` is connected to:

- status transitions
- comments
- attachments
- acceptance
- assignment
- child work
- timeline
- SLA display

Any broad refactor here can easily break user-visible operations without obvious compile-time failures.

### 5.4 Observer mode safety risk

`EmployeesPage` explicitly protects observer mode from writes on the frontend, but this mode should always be treated as backend-critical, not only UI-critical. The current implementation appears careful, but the surface is large.

### 5.5 Incomplete V2 migration risk

If product keeps adding features into V1 pages while navigation keeps advertising V2, the console will harden around a transitional architecture and become harder to split later.

## 6. Places that cannot be broken

- Scope persistence and URL propagation in `Shell` and `api.ts`. Breaking this will affect observer mode, provider linked-client mode and deep links.
- Backend PBAC matching by `(role, companyType)` and wildcard fallback. This is the foundation for correct client/provider admin behavior.
- Permission matrix transactional editing and protected `PLATFORM_ADMIN` permissions. Breaking this can lock out the platform.
- Ticket acceptance flow. It is business-sensitive and intentionally separated from generic status editing.
- Technician claim/assignment/status flows, especially the distinction between:
  - `TICKETS_ASSIGN`
  - `TICKETS_CLAIM`
  - `TICKETS_STATUS_CHANGE`
- Employees protections:
  - cannot deactivate self
  - cannot deactivate last active admin
  - correct location binding scope for provider linked clients
- Read-only observer mode for `PLATFORM_ADMIN` when viewing tenant employees and tickets in cross-tenant context.

## 7. Components that are better to refactor

### `Shell`

Refactor target, not rewrite target.

Reason:

- the responsibility is valid
- the composition is right
- but session, scope, navigation and layout concerns should be split into smaller hooks/components

Suggested split:

- `useShellScope`
- `useShellSession`
- `useShellNavigation`
- presentational sidebar/topbar components

### `PermissionsPage`

Refactor target.

Reason:

- the page itself is understandable
- backend contract is already decent
- the main improvement is to separate draft state and diff/apply logic into a dedicated hook

### `EmployeesPage`

Refactor target with caution.

Reason:

- business logic is real and valuable
- but the page should stop being the primary place where binding, observer-mode and specialization policies live

Recommended direction:

- move data/action orchestration into hooks
- keep page as composition layer
- preserve existing behavioral protections during extraction

### Navigation model

Refactor target.

Reason:

- static nav config is fine
- but visibility logic should move toward permission/capability-driven config instead of ad hoc role branches

## 8. Components that are better to rewrite

### `Dashboard`

Rewrite from scratch as a real feature, because it does not meaningfully exist yet. Current implementation is only a placeholder contract.

### `TicketPage`

Rewrite in feature slices, not in one big bang.

Reason:

- current file is too central and too coupled
- simple incremental refactoring may reduce readability but still preserve the same structural problem

Recommended rewrite shape:

- `TicketPageShell`
- `useTicketScope`
- `useTicketActions`
- `TicketDetailsPanel`
- `TicketAssignmentPanel`
- `TicketAcceptancePanel`
- `TicketTimelinePanel`
- `TicketAttachmentsPanel`

This should still be delivered gradually behind stable route/API behavior.

### `SettingsPage`

Rewrite is justified if product expects this route to become a real management settings area. Current page is intentionally minimal and closer to local app preferences than a console settings module.

## Additional conclusion

Management Console today is operationally usable, but architecturally transitional.

The strongest part is the backend authorization direction: PBAC, company-type-aware grants, transactional matrix editing, and explicit policy layering.

The weakest part is the frontend convergence around that model. The UI still thinks mostly in hardcoded roles, while the backend has already moved toward permission-centric control.

If only one strategic direction is chosen next, it should be this:

1. make frontend capabilities permission-driven
2. isolate V2 feature boundaries
3. split `TicketPage` before adding more workflow depth into it
