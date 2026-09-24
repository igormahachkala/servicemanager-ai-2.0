# Stage Acceptance Data Plan — 2026-07-31

Repository: `servicemanager-ai-2.0`

Acceptance matrix: `docs/operations/2026-07-30-combined-release-acceptance-matrix.md`

Planned RC branch: `release/2026-07-subcontractor-workflow-rc1`

Mode: Stage preparation only. Do not deploy, do not create Stage data from this document directly, and do not use real employee personal data.

## Purpose

This plan defines the synthetic Stage entities, accounts, access scopes, ticket fixtures, analytics dataset, API negative checks, desktop/mobile prerequisites, account handoff, and cleanup requirements for Product Acceptance of the combined ServiceManager release:

- HOTFIX-001 creator/assignee identity.
- HOTFIX-002 contractor acceptance.
- HOTFIX-003 access scope and location bindings.
- Assignment candidate integration.
- Subcontractor ticket creation.
- Create+claim.
- Create+assign.
- Full subcontractor lifecycle.
- Subcontractor analytics V1.
- Desktop/mobile smoke.
- Backend tenant isolation.

## Source Alignment

| Source | Expected use |
|---|---|
| Combined acceptance matrix | Test scenario authority and PASS/FAIL rows |
| RC branch | Deployment source once immutable RC exists |
| Synthetic Stage fixtures | Product Acceptance only |
| Stage secrets/account handoff | Password distribution only |

Passwords, real phone numbers, and real employee names must not be committed to git.

## Companies

| Fixture key | Company type | Legal name | Brand name | Role in scenarios | Required relationships | Positive/negative |
|---|---|---|---|---|---|---|
| `client-a` | CLIENT | `ООО "Stage Client A"` | `Stage Client A` | Main customer tenant for create, lifecycle, acceptance, analytics | ACTIVE PRIMARY contract to `primary-provider`; ACTIVE SECONDARY contract to `secondary-provider-a`; inactive/closed contract to foreign controls | Positive |
| `client-b` | CLIENT | `ООО "Stage Client B"` | `Stage Client B` | Foreign tenant isolation control | Optional ACTIVE contract only to unrelated provider; no usable contract from `secondary-provider-a` | Negative |
| `primary-provider` | PROVIDER | `ООО "Stage Primary Provider"` | `Stage Primary Provider` | Existing main service provider | ACTIVE PRIMARY contract with `client-a` | Positive and regression |
| `secondary-provider-a` | PROVIDER | `ООО "Stage Secondary Provider A"` | `Stage Subcontractor A` | Subcontractor under V1 model; no separate `SUBCONTRACTOR` role | ACTIVE SECONDARY contract with `client-a`; location scopes for its users | Positive |
| `foreign-secondary-provider-b` | PROVIDER | `ООО "Stage Foreign Secondary Provider B"` | `Stage Foreign Subcontractor B` | Foreign provider negative control | Inactive/closed/absent usable contract to `client-a`; optional ACTIVE contract to `client-b` | Negative |

## Service Contracts

| Fixture key | Client | Provider | Type | Status | Locations | Test purpose |
|---|---|---|---|---|---|---|
| `contract-client-a-primary-active` | `client-a` | `primary-provider` | PRIMARY | ACTIVE | All Client A Stage test locations | Primary provider regression, existing board/assignment/analytics |
| `contract-client-a-secondary-a-active` | `client-a` | `secondary-provider-a` | SECONDARY | ACTIVE | Client A allowed locations by UserAccessScope/UserLocationBinding | Subcontractor create, assignment, lifecycle, analytics |
| `contract-client-a-foreign-secondary-inactive` | `client-a` | `foreign-secondary-provider-b` | SECONDARY | INACTIVE | None effective | Inactive contract denial |
| `contract-client-a-foreign-secondary-ended` | `client-a` | `foreign-secondary-provider-b` | SECONDARY | ENDED | None effective | Closed contract denial |
| `contract-client-b-foreign-secondary-active` | `client-b` | `foreign-secondary-provider-b` | SECONDARY | ACTIVE | Client B foreign fixtures only | Foreign tenant isolation control |

Contract setup must not use provider-to-provider hierarchy or a `SubcontractorContract` model. V1 represents subcontractor access as an existing PROVIDER company with an ACTIVE ServiceContract.

## Locations

| Fixture key | Display name | Owner company | Contract coverage | Expected access | Scope bindings |
|---|---|---|---|---|---|
| `loc-a-allowed-1` | `Stage Client A Allowed Location 1` | `client-a` | PRIMARY and SECONDARY active contracts | Accessible to selected-scope Secondary A users with binding | Bind `secondary-tech-selected-1`, `secondary-tech-selected-2`, selected admin/master fixtures |
| `loc-a-allowed-2` | `Stage Client A Allowed Location 2` | `client-a` | PRIMARY and SECONDARY active contracts | Accessible only to multi-location selected-scope users | Bind `secondary-tech-selected-2` |
| `loc-a-forbidden` | `Stage Client A Forbidden Location` | `client-a` | Covered by contract but not by selected user scope | Must not be available to selected-scope user without binding | No binding for selected positive user; stale legacy row only where explicitly required |
| `loc-b-foreign` | `Stage Client B Foreign Location` | `client-b` | Foreign provider B only | Must never be available to Secondary A users | No Secondary A binding; direct API negative target |

## Equipment

| Fixture key | Display name | Company | Location | Status | Test scenarios |
|---|---|---|---|---|---|
| `eq-a-allowed-1` | `Stage Pump A1` | `client-a` | `loc-a-allowed-1` | ACTIVE | Positive desktop/mobile create with equipment |
| `eq-a-allowed-long` | `Stage Very Long Equipment Name For Responsive Acceptance Testing A1` | `client-a` | `loc-a-allowed-1` | ACTIVE | Long-label desktop/mobile layout |
| `eq-a-forbidden-location` | `Stage Fan A Forbidden Location` | `client-a` | `loc-a-forbidden` | ACTIVE | Same-client forbidden location/equipment negative case |
| `eq-b-foreign` | `Stage Foreign Client B Boiler` | `client-b` | `loc-b-foreign` | ACTIVE | Cross-tenant equipment negative case |
| `eq-a-inactive` | `Stage Inactive Pump A1` | `client-a` | `loc-a-allowed-1` | INACTIVE if supported by current model | Optional inactive-equipment validation if model/API exposes status semantics |

If equipment status is not enforced by the current V1 model, `eq-a-inactive` remains an optional documentation fixture and must not be treated as a mandatory PASS blocker.

## Problem Categories

| Fixture key | Display name | Company | Status | Test scenarios |
|---|---|---|---|---|
| `cat-a-allowed` | `Stage Plumbing Repair` | `client-a` | ACTIVE | Positive create, analytics by category |
| `cat-a-long` | `Stage Very Long Problem Category Name For Responsive Acceptance Testing` | `client-a` | ACTIVE | Long-label desktop/mobile layout |
| `cat-a-inactive` | `Stage Inactive Category A` | `client-a` | INACTIVE | Optional inactive-category UI/API validation if endpoint exposes inactive state |
| `cat-b-foreign` | `Stage Foreign Category B` | `client-b` | ACTIVE | Direct API foreign category negative case |

## Users And Accounts

All accounts must be synthetic `.local` addresses. Passwords must be distributed only through the approved protected Stage secrets/account handoff process.

| Fixture key | Login | Company | Role | Required permissions | Access scope | Location bindings | Test purpose |
|---|---|---|---|---|---|---|---|
| `platform-admin` | `stage-platform-admin@stage.local` | Platform | PLATFORM_ADMIN | Existing platform observer/admin permissions | Platform observer | None | Read-only observer smoke, company visibility checks |
| `client-admin-a` | `stage-client-admin-a@stage.local` | `client-a` | ADMIN | `TICKETS_CREATE`, `TICKETS_VIEW`, acceptance permissions, analytics if applicable | Own client tenant | Own client locations as existing client rules allow | Customer acceptance, identity, client-side regression |
| `primary-admin` | `stage-primary-admin@stage.local` | `primary-provider` | ADMIN | `TICKETS_VIEW`, `TICKETS_ASSIGN`, `TICKETS_CREATE`, `ANALYTICS_VIEW` | PRIMARY linked client | Existing primary access | Primary provider regression |
| `primary-dispatcher` | `stage-primary-dispatcher@stage.local` | `primary-provider` | DISPATCHER | `TICKETS_VIEW`, `TICKETS_ASSIGN`, status/comment where existing policy allows | PRIMARY linked client | Existing primary access | Assignment regression |
| `primary-master` | `stage-primary-master@stage.local` | `primary-provider` | MASTER | `TICKETS_VIEW`, `TICKETS_CLAIM`, `TICKETS_STATUS_CHANGE`, `TICKETS_CREATE` | PRIMARY linked client | Existing primary access | Master lifecycle regression |
| `primary-tech` | `stage-primary-tech@stage.local` | `primary-provider` | TECHNICIAN | `TICKETS_VIEW`, `TICKETS_CLAIM`, `TICKETS_STATUS_CHANGE`, `TICKETS_CREATE` | Selected or legacy according to existing primary fixture | At least `loc-a-allowed-1` | Primary technician regression |
| `secondary-admin-a` | `stage-secondary-admin-a@stage.local` | `secondary-provider-a` | ADMIN | `TICKETS_CREATE`, `TICKETS_VIEW`, `TICKETS_ASSIGN`, `ANALYTICS_VIEW` | SECONDARY linked client selected scope | `loc-a-allowed-1`, `loc-a-allowed-2` where needed | Create+assign, analytics, candidate filtering |
| `secondary-master-a` | `stage-secondary-master-a@stage.local` | `secondary-provider-a` | MASTER | `TICKETS_CREATE`, `TICKETS_VIEW`, `TICKETS_CLAIM`, `TICKETS_ASSIGN`, `TICKETS_STATUS_CHANGE` | SECONDARY linked client selected scope | `loc-a-allowed-1` | Create+claim, contractor acceptance, lifecycle |
| `secondary-tech-selected-1` | `stage-secondary-tech-selected-1@stage.local` | `secondary-provider-a` | TECHNICIAN | `TICKETS_CREATE`, `TICKETS_VIEW`, `TICKETS_CLAIM`, `TICKETS_STATUS_CHANGE` | `SELECTED_LOCATIONS` | `loc-a-allowed-1` | Positive selected single-location create+claim |
| `secondary-tech-selected-2` | `stage-secondary-tech-selected-2@stage.local` | `secondary-provider-a` | TECHNICIAN | `TICKETS_CREATE`, `TICKETS_VIEW`, `TICKETS_CLAIM`, `TICKETS_STATUS_CHANGE` | `SELECTED_LOCATIONS` | `loc-a-allowed-1`, `loc-a-allowed-2` | Multi-location scope |
| `secondary-tech-empty-selected` | `stage-secondary-tech-empty-selected@stage.local` | `secondary-provider-a` | TECHNICIAN | Same as technician positive user | `SELECTED_LOCATIONS` | None | Empty selected scope fail-close |
| `secondary-tech-restricted-empty` | `stage-secondary-tech-restricted-empty@stage.local` | `secondary-provider-a` | TECHNICIAN | Same as technician positive user | `RESTRICTED_EMPTY` | Optional stale legacy rows for negative test | Restricted-empty fail-close |
| `secondary-tech-legacy` | `stage-secondary-tech-legacy@stage.local` | `secondary-provider-a` | TECHNICIAN | Same as technician positive user | No explicit UserAccessScope | Legacy rows only | Legacy compatibility |
| `secondary-tech-stale-legacy` | `stage-secondary-tech-stale-legacy@stage.local` | `secondary-provider-a` | TECHNICIAN | Same as technician positive user | `SELECTED_LOCATIONS` | Provider binding to `loc-a-allowed-1`; stale legacy binding to `loc-a-forbidden` | Explicit scope overrides stale legacy |
| `secondary-tech-inactive` | `stage-secondary-tech-inactive@stage.local` | `secondary-provider-a` | TECHNICIAN | Would otherwise match positive permissions | Same as selected positive user | `loc-a-allowed-1` | Must be excluded from candidates/direct assignment |
| `secondary-tech-deleted` | `stage-secondary-tech-deleted@stage.local` | `secondary-provider-a` | TECHNICIAN | Would otherwise match positive permissions | Same as selected positive user | `loc-a-allowed-1` | Soft-deleted user exclusion |
| `foreign-secondary-admin-b` | `stage-foreign-secondary-admin-b@stage.local` | `foreign-secondary-provider-b` | ADMIN | Similar to provider admin in own tenant only | Foreign provider/client only | No Client A binding | Cross-provider negative checks |
| `foreign-secondary-tech-b` | `stage-foreign-secondary-tech-b@stage.local` | `foreign-secondary-provider-b` | TECHNICIAN | Own foreign provider technician permissions | Foreign provider/client only | `loc-b-foreign` only if needed | Foreign employee assignment negative case |

## Access Scope Fixtures

| Fixture key | User | Explicit scope | UserLocationBinding rows | Expected result |
|---|---|---|---|---|
| `scope-all-legacy-primary` | `primary-admin` or `primary-tech` | None | None or existing primary legacy setup | Existing own/primary behavior remains unchanged |
| `scope-selected-one` | `secondary-tech-selected-1` | `SELECTED_LOCATIONS` for `secondary-provider-a` | Provider-scoped binding to `loc-a-allowed-1` | A1 allowed, A2/B1 denied |
| `scope-selected-many` | `secondary-tech-selected-2` | `SELECTED_LOCATIONS` for `secondary-provider-a` | Provider-scoped bindings to `loc-a-allowed-1`, `loc-a-allowed-2` | `loc-a-allowed-1` and `loc-a-allowed-2` allowed; `loc-a-forbidden` and `loc-b-foreign` denied |
| `scope-selected-none` | `secondary-tech-empty-selected` | `SELECTED_LOCATIONS` for `secondary-provider-a` | None | Fail-close; no location access |
| `scope-restricted-empty` | `secondary-tech-restricted-empty` | `RESTRICTED_EMPTY` for `secondary-provider-a` | Optional stale legacy row to `loc-a-allowed-1` | Fail-close; legacy ignored |
| `scope-legacy-no-explicit` | `secondary-tech-legacy` | None | Legacy client-scoped binding to `loc-a-allowed-1` | Legacy compatibility only; A1 allowed, A2 denied |
| `scope-stale-legacy-explicit` | `secondary-tech-stale-legacy` | `SELECTED_LOCATIONS` for `secondary-provider-a` | Provider binding A1 plus stale client-scoped row to forbidden location | Only provider-scoped explicit-selected binding is effective |
| `scope-foreign-provider-binding` | `secondary-tech-selected-1` | `SELECTED_LOCATIONS` | Foreign provider binding row if fixture tooling permits | Foreign provider row ignored |
| `scope-duplicate-binding` | `secondary-tech-selected-2` | `SELECTED_LOCATIONS` | Duplicate provider-scoped rows to same location if DB allows, otherwise duplicate payload attempt | Stable deduped result or DB uniqueness rejection |

## Ticket Fixtures

Do not create tickets during plan preparation. The following describes what Acceptance must create manually versus what may be preloaded by a Stage fixture owner.

| Fixture key | Creation method | Role/account | Purpose | Required state |
|---|---|---|---|---|
| `ticket-desktop-create-unassigned` | Create during Acceptance through desktop | `secondary-admin-a` | Desktop create, leave unassigned, identity | NEW, unassigned, Client A, A1/E1/C1 |
| `ticket-mobile-create-claim` | Create during Acceptance through mobile/MAX | `secondary-tech-selected-1` | Mobile create+claim | ASSIGNED to creator or equivalent claim state |
| `ticket-desktop-create-assign` | Create during Acceptance through desktop | `secondary-admin-a` | Create+assign to allowed Secondary A employee | ASSIGNED to `secondary-tech-selected-1` |
| `ticket-mobile-create-assign` | Create during Acceptance through mobile | `secondary-admin-a` | Mobile create+assign | ASSIGNED to allowed Secondary A employee |
| `ticket-lifecycle-full` | Create during Acceptance | `secondary-tech-selected-1` or `secondary-master-a` | Start, comment, photos before/after, complete, acceptance, return, re-complete | Moves through NEW/ASSIGNED/IN_PROGRESS/AWAITING_ACCEPTANCE/DONE |
| `ticket-customer-acceptance` | May be prepared before Acceptance | `client-admin-a` or fixture owner | Customer acceptance positive | AWAITING_ACCEPTANCE |
| `ticket-returned-recomplete` | May be prepared before Acceptance | Fixture owner | Return for correction and re-complete | AWAITING_ACCEPTANCE before rejection |
| `ticket-historical-inactive-assignee` | Prepare before Acceptance | Fixture owner | HOTFIX-001 inactive historical assignee display | Assigned to now inactive/deleted historical user; readable but not candidate |
| `ticket-foreign-client-negative` | Prepare before Acceptance | Fixture owner | Foreign tenant read/analytics negative | Client B ticket inaccessible to Secondary A |
| `ticket-overdue-sla` | Prepare before Acceptance if time travel/seed allowed | Fixture owner | SLA breach analytics | SLA breached |
| `ticket-sla-pass` | Prepare before Acceptance | Fixture owner | SLA pass analytics | SLA evaluated and not breached |

## Analytics Dataset

Minimum dataset for `secondary-provider-a` scoped analytics. Counts below are exact target totals inside the selected analytics period unless marked outside-period.

| Metric/scenario | Ticket count | Fixture details |
|---|---:|---|
| Created total in period | 12 | All Client A scoped, visible to Secondary A by operational scope |
| Assigned | 8 | Assigned to Secondary A employees |
| In progress | 3 | Status `IN_PROGRESS` |
| Completed/final accepted | 3 | Status `DONE` |
| Awaiting/returned workflow | 2 | One awaiting acceptance, one returned/re-completed scenario |
| Overdue/SLA breach | 2 | `slaBreachedAt` set or naturally breached by Stage fixture |
| SLA pass | 4 | SLA evaluated without breach |
| Response time evaluated | 6 | Tickets with assignment/status history sufficient for mean response |
| Completion time evaluated | 4 | Tickets with completion status history |
| By location A1 | 7 | Visible allowed location |
| By location A2 allowed multi-scope | 3 | Only visible to multi-location user/scope where expected |
| Forbidden location exclusion | 2 | Client A forbidden-location tickets not visible to selected-one user |
| By employee `secondary-tech-selected-1` | 4 | Assigned workload |
| By employee `secondary-tech-selected-2` | 3 | Assigned workload |
| By category `cat-a-allowed` | 8 | Main category |
| By category `cat-a-long` | 4 | Long label/category UI |
| Priority NORMAL | 7 | Normal priority |
| Priority URGENT | 5 | Urgent priority |
| Outside period | 3 | Same tenant/scope but outside selected period; must be excluded |
| Zero-state period | 0 | A date range with no scoped tickets |
| Foreign tenant exclusion | 5 | Client B/foreign provider tickets; must not appear |

If the implementation does not expose a dedicated returned count, the returned/re-complete scenario must be validated through lifecycle/timeline evidence and not treated as an analytics blocker.

Planned/emergency, advanced problem-equipment analytics, exports, forecasting, workload planning, checklists, materials, and costs are roadmap and must not be mandatory for Analytics V1 acceptance.

## API Negative Checks

Prepare request templates only. Do not execute before RC deploy.

| Check ID | Actor | Request target | Payload manipulation | Expected result | Evidence required |
|---|---|---|---|---|---|
| `api-neg-foreign-client` | `secondary-admin-a` | `POST /tickets` | `clientCompanyId=client-b` with Client B location/category/equipment | 403/404/400; no ticket created | Request/response, DB no-row summary |
| `api-neg-forbidden-location` | `secondary-tech-selected-1` | `POST /tickets` | `locationId=loc-a-forbidden` | 403/404/400; no ticket created | Response and no-row summary |
| `api-neg-foreign-equipment` | `secondary-admin-a` | `POST /tickets` | `equipmentId=eq-b-foreign` | 403/400; no ticket created with foreign equipment | Response and no-row summary |
| `api-neg-equipment-other-location` | `secondary-admin-a` | `POST /tickets` | `locationId=loc-a-allowed-1`, `equipmentId=eq-a-forbidden-location` | 400/403; no ticket created | Response and no-row summary |
| `api-neg-foreign-category` | `secondary-admin-a` | `POST /tickets` | `categoryId=cat-b-foreign` | 400/403; no ticket created | Response and no-row summary |
| `api-neg-foreign-assignee` | `secondary-admin-a` | `POST /tickets` or assign endpoint | `assignTechnicianId=foreign-secondary-tech-b` | 403/404/400; assignee unchanged | Response and DB summary |
| `api-neg-inactive-assignee` | `secondary-admin-a` | create+assign or assign endpoint | `assignTechnicianId=secondary-tech-inactive` | 403/404/400; assignee unchanged | Response and DB summary |
| `api-neg-deleted-assignee` | `secondary-admin-a` | create+assign or assign endpoint | `assignTechnicianId=secondary-tech-deleted` | 403/404/400; assignee unchanged | Response and DB summary |
| `api-neg-restricted-empty` | `secondary-tech-restricted-empty` | `POST /tickets`, board, candidates | Allowed-looking Client A IDs | Fail-close; no access | Response evidence |
| `api-neg-empty-selected` | `secondary-tech-empty-selected` | `POST /tickets`, board, candidates | Allowed-looking Client A IDs | Fail-close; no access | Response evidence |
| `api-neg-analytics-foreign` | `secondary-admin-a` | `GET /analytics/overview` | `linkedClientCompanyId=client-b` | 403/400 or empty permitted response with no leak | Response evidence |
| `api-neg-linked-contract-alone-acceptance` | `foreign-secondary-admin-b` | acceptance endpoint | Ticket belongs to Client A and not created/assigned to foreign provider | 403; acceptance unchanged | Response and ticket status |

## Desktop Requirements

| Requirement | Details |
|---|---|
| Browser | Current supported desktop browser for Stage |
| Viewports | 1440 px and 1024 px |
| Routes | Board, create, ticket detail, analytics |
| Test accounts | `secondary-admin-a`, `secondary-master-a`, `secondary-tech-selected-1`, `client-admin-a`, `primary-admin`, `foreign-secondary-admin-b` |
| Upload assets | Synthetic photos only; no real site/user/customer images |
| Create flow | linked client, location, category, equipment, optional photo, leave unassigned, create+assign |
| Identity | creator/assignee full name, role, legalName/brandName/name fallbacks |
| Analytics | scoped period, zero-state, foreign exclusion |

## Mobile Requirements

| Requirement | Details |
|---|---|
| Device/browser | Physical test device or browser mobile mode |
| Viewports | 390 px and 360 px minimum |
| Routes | `/m/create`, `/max/create`, mobile home, mobile ticket detail, mobile analytics if available |
| Stage URL | Stable Stage frontend URL after RC deploy |
| Upload | Camera available or file upload fallback enabled |
| Synthetic photos | Prepare at least 6 small image files: request photo, before photo, after photo, invalid/oversized optional negative if needed |
| Login | Mobile-capable logins for Secondary A admin/master/technician, client admin |
| Permissions | `TICKETS_CREATE`, `TICKETS_CLAIM`, `TICKETS_ASSIGN`, `TICKETS_STATUS_CHANGE` according to role |
| Equipment selector | `eq-a-allowed-1` and long-name equipment visible for allowed location |
| Create+claim | `secondary-tech-selected-1` validates `postCreateAction=claim_self` path |
| Create+assign | `secondary-admin-a` validates `postCreateAction=assign_employee` path |
| Lifecycle | comment, before/after photo upload, complete, acceptance result |

## Account Handoff Process

1. Stage owner creates or verifies synthetic accounts only.
2. Passwords are generated outside git.
3. Passwords are distributed through the approved protected Stage secrets/account handoff channel.
4. The git document stores only account keys and synthetic `.local` emails.
5. Each test executor records only account key/login, never password.
6. After Acceptance, Stage owner rotates or disables temporary accounts that are not part of the permanent synthetic QA set.

## Cleanup Plan After Acceptance

| Item | Cleanup action | Owner |
|---|---|---|
| Temporary tickets | Archive or delete according to Stage data policy | Stage owner |
| Draft attachments/photos | Remove temporary uploads if policy allows; otherwise mark as synthetic | Stage owner |
| Temporary users | Disable or rotate passwords for non-permanent test accounts | Stage owner |
| Temporary bindings/scopes | Remove test-only duplicate/stale/negative bindings if they pollute future tests | Stage owner |
| Temporary contracts | Keep stable fixture contracts if useful; otherwise end/deactivate test-only contracts | Stage owner |
| Analytics fixtures | Keep only if accepted as reusable QA baseline; otherwise cleanup after evidence is captured | Stage owner |
| Evidence | Store screenshots/API logs in accepted evidence storage, not in production code repo unless explicitly requested | Review owner |

Cleanup must not touch Production.

## Execution Guardrails

- Do not deploy from this plan.
- Do not create Stage users from this plan without Stage owner approval.
- Do not change Stage database during documentation preparation.
- Do not use real employee names, emails, phone numbers, or photos.
- Do not store passwords, tokens, cookies, or session data in git.
- Do not create migrations for this plan.
- Do not change product code.
- Do not perform Production changes.

## Readiness Checklist

- Required synthetic companies are approved.
- Required contracts are approved.
- Required locations/equipment/categories are approved.
- Required users and protected password handoff are approved.
- Access scope fixtures cover selected, restricted, legacy, stale, duplicate, inactive, and deleted cases.
- Ticket and analytics datasets can be created on Stage after RC deploy.
- API negative checks are prepared but not executed before deploy.
- Desktop/mobile devices and synthetic photos are available.
- Cleanup owner and policy are confirmed.
