# Subcontractor Capabilities Update

Date: 2026-07-30

## Implemented in V1

- A subcontractor is represented by an existing PROVIDER company with an ACTIVE ServiceContract.
- PRIMARY and SECONDARY linked-client contracts can use the ticket creation flow when the actor has `TICKETS_CREATE`.
- Ticket creation resolves the real CLIENT owner from the selected client/location and never substitutes the client company as the creator company.
- Location, category, equipment, attachments, create+claim, and create+assign are validated again on the backend.
- `RESTRICTED_EMPTY` fails closed.
- explicit `SELECTED_LOCATIONS` without valid bindings fails closed through the existing UserAccessScope interpreter.
- Legacy tenant-wide behavior is preserved only when no explicit location scope exists.
- Desktop and mobile create flows support equipment selection.
- Desktop and mobile create flows support:
  - leave unassigned;
  - create and claim self;
  - create and assign an employee of the same provider company.
- Assignment candidates and direct assignment use the same provider-company and location-scope restrictions.
- SECONDARY provider analytics are available in a scoped mode and use the shared secondary operational ticket restriction.

## Permissions

- Create requires `TICKETS_CREATE`.
- Create and claim requires `TICKETS_CLAIM` in addition to `TICKETS_CREATE`.
- Create and assign requires `TICKETS_ASSIGN` in addition to `TICKETS_CREATE`.
- Assignment targets must be active, not deleted, executor-capable users in the same provider company.
- Foreign provider employees are not assignable through the provider create flow or direct manual assignment.

## Scope Rules

- `clientCompanyId` must be the actor's own client company or an ACTIVE linked client.
- `locationId` must belong to the resolved client company and pass UserAccessScope/UserLocationBinding checks.
- `equipmentId` must belong to the resolved client company and selected location.
- `categoryId` must belong to the resolved client company.
- Catalog APIs for locations, categories, and equipment expose linked-client data only after backend scope checks.
- Frontend filtering is treated as UX only; backend create and assignment checks are authoritative.

## Acceptance Scenarios

- SECONDARY provider creates a ticket for an allowed client/location.
- Creating for a foreign client is rejected.
- Creating for a foreign or unbound location is rejected.
- Creating with foreign equipment is rejected.
- Creating with equipment from another location is rejected.
- Creating with a foreign category is rejected.
- Create and claim succeeds only for an eligible in-scope executor.
- Create and assign succeeds only for an eligible employee of the actor provider company.
- Inactive, deleted, or foreign-provider employees are rejected.
- Analytics in SECONDARY mode excludes unrelated client/provider data by applying secondary operational scope.

## Not Implemented in V1

- No new Prisma models.
- No new subcontractor role.
- No provider-to-provider hierarchy.
- No exports, forecasting, workload planning, maintenance checklists, materials, or cost tracking.
- No Stage or Production deployment changes.

## Risks and Follow-Up

- Existing legacy location-scope behavior remains tenant-wide when no explicit UserAccessScope exists; this is intentional compatibility and should be audited per customer before launch.
- SECONDARY analytics are intentionally limited to V1 operational metrics; advanced forecasts and exports remain roadmap items.
- Runtime acceptance should be repeated with a real provider, SECONDARY provider, technician, dispatcher, and client account matrix before production rollout.
