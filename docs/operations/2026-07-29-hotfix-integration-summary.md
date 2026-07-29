# ServiceManager.AI — Operational Summary — 2026-07-29

Status: Integration complete, independent integration review pending  
Project: ServiceManager.AI  
Repository: `igormahachkala/servicemanager-ai-2.0`

## 1. Executive Summary

On 2026-07-29, the three approved hotfix lines were integrated into a dedicated integration branch.

The integration combined:

- HOTFIX-001 — creator and assignee identity behavior;
- HOTFIX-002 — MASTER and contractor ADMIN ticket acceptance rules;
- HOTFIX-003 — technician location bindings and explicit access scope semantics.

The highest-risk integration point was assignment candidate filtering. The old logic searched `UserLocationBinding.companyId` by client company, while HOTFIX-003 stores canonical bindings by employer/provider company. This mismatch could hide valid bindings and, in some paths, turn the absence of rows into unintended unrestricted access.

The integration now applies provider-scoped bindings, explicit `UserAccessScope`, fail-closed behavior, and controlled legacy fallback.

Current decision:

`READY FOR INDEPENDENT INTEGRATION REVIEW`

No Stage or Production changes were made.

## 2. Repository State

Repository path:

`/Users/igor/Documents/GitHub/servicemanager-ai-2.0`

Integration worktree:

`/Users/igor/Documents/GitHub/sma-hotfix-integration-001`

Integration branch:

`integration/2026-07-hotfix-bundle-001`

Remote branch:

`origin/integration/2026-07-hotfix-bundle-001`

Base branch:

`origin/release/sma-mobile-guided-tour-001`

Base commit:

`a2bc140a0e8c02765adc14967085430c52de8ae6`

Final integration commit:

`36e794a603c78943cfae86471b834433e452df7e`

Commit message:

`fix(access): integrate technician scope and ticket hotfixes`

Local and remote integration SHAs are equal.

Final worktree state: clean.

## 3. Integrated Hotfix States

### HOTFIX-001

Final commit:

`2975a2aea5e7f5ec7490d9c005c1a23f77f70985`

Required parent state:

`b8f1766`

Reason for including parent state:

Creator and assignee identity behavior was introduced in the parent commit and was required for the final hotfix state to be complete.

Preserved behavior:

- creator identity presentation;
- assignee identity presentation;
- `legalName → brandName → name` organization fallback;
- no substitution of missing creator company with ticket client company;
- inactive and deleted executor filtering for new assignment candidates;
- historical assignee display remains readable.

### HOTFIX-002

Final commit:

`d4be923f1dfaf5f359ced90034efd13c63c21dc6`

Preserved behavior:

- MASTER acceptance requires readable ticket access and an allowed actor relationship;
- contractor ADMIN acceptance requires an allowed relationship;
- generic linked contract alone is not an acceptance grant;
- direct API calls use the same backend permission decision as UI actions.

### HOTFIX-003

Final commit:

`9e510804ae090510814355df2675ad0a7fd4ad81`

Required parent state:

`b2c26aa`

Reason for including parent state:

The final HOTFIX-003 commit was not self-contained from the release base.

Preserved behavior:

- canonical provider/employer-scoped `UserLocationBinding` semantics;
- explicit `UserAccessScope` precedence;
- `RESTRICTED_EMPTY` fail-closed behavior;
- `SELECTED_LOCATIONS` fail-closed behavior when binding rows are absent;
- legacy client-scoped fallback only when no explicit scope exists;
- backward-compatible historical tenant-wide behavior only when there is no explicit scope and no bindings.

## 4. Conflict Resolution

### `ticket-access.utils.ts`

Conflict resolution preserved both:

- inactive and deleted user checks;
- provider-scoped location access semantics.

### `ticketActorIdentity.ts`

Conflict resolution preserved:

- `legalName → brandName → name` organization priority;
- no fallback from missing creator company to ticket company.

No unresolved conflict markers were reported.

## 5. Assignment Candidate Integration

### Root Cause

The previous assignment candidate logic searched `UserLocationBinding.companyId` using the client company.

HOTFIX-003 defines canonical bindings using the technician employer/provider company.

Consequences of the old mismatch:

- valid canonical provider-scoped bindings could be missed;
- empty query results could be interpreted as unrestricted access;
- explicit scope semantics could be bypassed indirectly;
- manual assignment and candidate listing could diverge.

### Implemented Fix

`tickets.assignment.service.ts` now:

- loads only active and non-deleted candidate users;
- resolves the candidate employer company;
- applies explicit `UserAccessScope`;
- reads canonical provider-scoped bindings;
- compares bindings against the ticket location and its client company;
- permits legacy client-scoped fallback only when no explicit scope exists;
- reuses the same access decision for manual assignment.

### Final Scope Semantics

- `RESTRICTED_EMPTY` → deny all relevant assignment access;
- `SELECTED_LOCATIONS` with no rows → deny;
- explicit scope ignores stale legacy rows;
- no explicit scope plus canonical or legacy rows → preserve compatible scoped behavior;
- no explicit scope and no rows → preserve historical tenant-wide behavior.

## 6. Tests Added

A regression matrix was added in:

`backend/src/tickets/tickets.assignment.service.spec.ts`

Covered scenarios include:

- selected allowed locations;
- selected forbidden locations;
- restricted-empty scope;
- legacy fallback;
- canonical provider bindings;
- inactive users;
- deleted users;
- MASTER candidates;
- duplicate bindings;
- foreign provider binding cases;
- manual assignment consistency.

## 7. Validation Results

The following checks passed:

- `git diff --check`;
- Prisma validation with local `DATABASE_URL`;
- Prisma client generation;
- backend build;
- focused backend tests: 9 suites, 171 tests passed;
- full backend Jest: 23 suites, 369 tests passed;
- web TypeScript build via `npx tsc -b`;
- web production build;
- `node scripts/test-ticket-actor-identity.mjs`;
- focused frontend lint.

Known non-blocking note:

- web build still reports the existing large chunk warning;
- focused backend lint surfaced pre-existing broad ESLint/Prettier debt in touched files;
- no broad formatting cleanup was performed to avoid unrelated changes.

## 8. Runtime Smoke

Local Docker runtime smoke was not performed because the local Docker daemon was unavailable and `docker.sock` was missing.

This does not change the integration status to PASS for release. Runtime verification remains a required next-stage activity.

No Stage or Production environment was touched.

## 9. Change Scope

The integration changed 33 files within the approved area:

- technicians;
- access helpers;
- ticket acceptance;
- assignment;
- ticket queries;
- timeline;
- identity presentation;
- mobile ticket presentation.

Explicitly excluded:

- migrations;
- environment files;
- Docker Compose changes;
- seeds;
- roadmap documents;
- generated artifacts;
- Push Flow;
- Legal;
- News;
- Desktop Console;
- AI Company.

## 10. Git Notes

Push status: PASS.

Remote branch was created successfully.

Local HEAD:

`36e794a603c78943cfae86471b834433e452df7e`

Remote HEAD:

`36e794a603c78943cfae86471b834433e452df7e`

Local upstream configuration still points to the base release branch because updating `.git/config` was blocked by filesystem permissions.

This is an operational cleanup item, not a content mismatch, because local and remote integration SHAs are equal.

## 11. Current Risks

The following risks remain open until independent review:

1. Manual conflict resolutions must be independently inspected.
2. Assignment scope logic is security-sensitive and requires immutable-commit review.
3. Runtime behavior has not yet been verified through Docker or Stage.
4. Existing lint debt remains in touched backend files.
5. The integration branch upstream tracking configuration should be corrected later without changing the reviewed commit.

## 12. Required Next Step

Agent 2 must perform an independent integration review against the immutable commit:

`36e794a603c78943cfae86471b834433e452df7e`

The review must verify:

- exact base and integrated commit presence;
- diff scope;
- manual conflict resolutions;
- assignment candidate filtering;
- explicit scope precedence;
- legacy fallback boundaries;
- HOTFIX-001 identity semantics;
- HOTFIX-002 acceptance semantics;
- HOTFIX-003 provider-scoped bindings;
- inactive and deleted user behavior;
- tenant isolation;
- test adequacy;
- clean local and remote SHA state.

No Stage deployment should occur before independent integration review passes.

## 13. Delivery Gate

Current gate:

`INDEPENDENT INTEGRATION REVIEW`

GO to Stage only after:

- immutable commit review passes;
- blocker findings equal zero;
- major security findings equal zero;
- assignment integration condition is independently confirmed;
- required build and test evidence is accepted;
- branch remains clean and unchanged.

## 14. Final Status

`READY FOR INDEPENDENT INTEGRATION REVIEW`

Confirmed:

- no Stage deployment;
- no Production deployment;
- no migrations;
- no seeds;
- no environment changes;
- no real data changes.
