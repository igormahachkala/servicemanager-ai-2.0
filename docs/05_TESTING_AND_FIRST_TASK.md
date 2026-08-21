# 05 Testing And First Task

This document has two parts:

1. testing and release checks;
2. a safe first task for a new developer.

## Testing And Release Checks

Use checks that match the changed surface.

Backend-only change:

```bash
cd backend
npx prisma validate
npm run prisma:generate
npm run build
npm test
```

Frontend-only change:

```bash
cd web
npm run build
npm run lint
```

Full-stack change:

```bash
cd backend
npx prisma validate
npm run prisma:generate
npm run build
npm test
cd ../web
npm run build
npm run lint
```

Repository-level whitespace check:

```bash
git diff --check
```

## Focused Test Expectations

- Authorization changes need positive and negative tests.
- Ticket workflow changes need status transition tests and runtime mutation checks.
- Service contract changes need contract role, location, specialization, and permission coverage.
- Notification changes need recipient eligibility tests and delivery-path checks.
- Mobile changes need mobile route checks and regression checks against the management contour when data is shared.
- Browser storage changes need normal login, failed login, rate-limit, session restore, logout, and storage failure checks.

## Runtime Acceptance Expectations

Runtime acceptance should identify:

- environment tested;
- exact user role tested;
- ticket or entity IDs used for evidence;
- console errors;
- network failures;
- API failures;
- unexpected authorization results;
- whether data writes were allowed by the task.

Use Stage for acceptance unless a task explicitly authorizes Production.

## Release Safety Checks

Before deployment tasks, confirm:

- source commit;
- current deployed HEAD;
- clean worktree;
- container health;
- migration status;
- latest backup requirement;
- rollback target;
- expected services to rebuild;
- services that must remain untouched.

After deployment tasks, confirm:

- deployed HEAD;
- application health;
- container status and restart counts;
- migration status;
- logs for the changed service;
- runtime acceptance result.

## First Task: Characterization Tests

The first practical onboarding task is intentionally safe.

Goal: write characterization tests for `backend/src/common/user-access-scope-mode.utils.ts`.

Do not change business logic.

The task teaches:

- repository navigation;
- backend test execution;
- safe code reading;
- test failure verification;
- one-task-one-commit workflow.

Expected time: two to three hours.

Result: one training commit on the developer's own branch. The branch is not merged.

## Part 0: Setup

Create a worktree:

```bash
git worktree add -b onboarding/<your-name> /private/tmp/sma-onboarding HEAD
cd /private/tmp/sma-onboarding
```

Backend:

```bash
cd backend
npm ci
npm run prisma:generate
npm run build
npm test
```

Frontend:

```bash
cd ../web
npm ci
npm run build
```

If the backend build reports unknown Prisma types, run `npm run prisma:generate` and build again. The generated Prisma client is not stored in the repository.

Record the number of passing backend tests. You will compare it at the end.

## Part 1: Navigation

Understand where ticket visibility is decided.

```bash
cd backend
grep -rn "resolveReadableTicketAccess" src --include=*.ts | grep -v spec
```

You should find one definition and multiple callers. This is the canonical ticket access resolver. Desktop, mobile, notifications, and related backend services must arrive at the same access model.

Open `src/tickets/ticket-access.utils.ts` and find the definition.

Provider access to a client ticket is the intersection of:

```text
Contract
-> Locations
-> Specializations
-> User Access
```

Find where location and specialization scope are computed:

```bash
grep -n "resolveActorLocationScope\|resolveProviderContractSpecializationScope" \
  src/tickets/ticket-access.utils.ts | head
```

Answer these in writing:

1. What does `resolveActorLocationScope` return when the user has no location bindings?
2. What happens when a contract is in `SELECTED_LOCATIONS` mode but has zero locations?
3. Why are contract specializations and executor specializations two separate rules?

## Part 2: Backend Characterization Tests

Read the target file:

```bash
cat src/common/user-access-scope-mode.utils.ts
```

Write tests in:

```text
backend/src/common/user-access-scope-mode.utils.spec.ts
```

Start with:

```ts
import { UserAccessLocationMode } from '@prisma/client'

import {
  interpretUserAccessLocationScope,
  isFailClosedLocationScope,
  resolveConstructorLocationMode,
  uniqueLocationIds,
} from './user-access-scope-mode.utils'

describe('user access location scope', () => {
  it('uniqueLocationIds drops duplicates, blanks and whitespace', () => {
    expect(uniqueLocationIds([' loc-1 ', 'loc-1', '', null, undefined, 'loc-2'])).toEqual([
      'loc-1',
      'loc-2',
    ])
  })

  it('no explicit mode and no bindings means whole contour', () => {
    expect(interpretUserAccessLocationScope({})).toEqual({
      locationMode: 'LEGACY_AUTO',
      runtimeMode: 'tenant_wide',
      locationIds: [],
    })
  })
})
```

Cover at minimum:

- `uniqueLocationIds` - duplicates, whitespace, `null`, and empty strings;
- `interpretUserAccessLocationScope` - all three modes, including no explicit mode with bindings;
- `resolveConstructorLocationMode` - explicit mode precedence and `staleLocationCount`;
- `isFailClosedLocationScope` - both cases where scope closes.

Run the focused test:

```bash
npx jest src/common/user-access-scope-mode.utils.spec.ts
```

## Part 3: Prove The Test Fails

A characterization test must fail when the characterized behavior breaks.

1. Temporarily change one value in `user-access-scope-mode.utils.ts`, for example return `'tenant_wide'` where the correct current behavior is `'restricted_empty'`.
2. Run the focused test. It must fail.
3. Restore the file:

```bash
git checkout src/common/user-access-scope-mode.utils.ts
```

4. Run the focused test again. It must pass.

Do not commit the temporary code change.

## Part 4: Frontend Reading

There is no frontend unit test suite. For this onboarding exercise, the frontend part is reading plus build verification.

```bash
cd ../web
grep -rn "export async function board" src/lib/api.ts
```

Look at the parameters such as `linkedClientCompanyId`, `companyId`, `status`, and `includeArchived`. These filters narrow the request on top of backend authorization.

Compare desktop and mobile calls:

```bash
grep -rn "api.board(" src/mobile src/views | head
```

Answer this: why can the frontend never be responsible for access even when it passes filters?

Run:

```bash
npm run build
```

## Part 5: Full Run And Commit

Run backend checks:

```bash
cd ../backend
npm test
npm run build
```

Then inspect the repository:

```bash
cd ..
git status --short
git diff --check
```

The only source change should be the new spec file.

Commit:

```bash
git add backend/src/common/user-access-scope-mode.utils.spec.ts

git commit -m "test(access): characterize user location scope modes"
```

The commit body should explain that the tests pin current location-scope behavior without changing business logic.

## Done When

You can answer:

1. Where is ticket visibility decided?
2. Which dimensions make up provider scope?
3. What does fail-closed mean, and where is it implemented?
4. Why can the frontend not be responsible for access?
5. Why does the project use one task per commit?
