# 11 Runtime Acceptance

Runtime acceptance proves that a deployed candidate works for real users in the real target environment. Unit tests, builds, and local API checks are required, but they are not runtime acceptance.

The standard acceptance contour is Stage. Production is never used for acceptance unless a task explicitly authorizes a read-only production gate or a production smoke check after deployment.

## Acceptance Principles

- Test the exact deployed SHA, not a local branch name.
- Use Stage-only accounts and Stage-only fixtures.
- Verify both positive and negative behavior.
- Verify UI metadata and actual backend mutations.
- Treat backend services as authoritative.
- Record evidence in a form another engineer can replay.
- Do not hardcode temporary ticket ids, user ids, or company ids as business rules.

For access-sensitive features, runtime acceptance must prove:

```text
Contract Context
AND Location Scope
AND Specialization Scope
AND Permission / Policy
```

## Preflight

Before running scenarios, record:

| Check | Required evidence |
| --- | --- |
| Environment | Stage host/API URL and confirmation that Production is untouched. |
| Deployed SHA | Exact commit deployed in the Stage worktree or container metadata. |
| Source branch | Branch or candidate name used for the deploy. |
| Git cleanliness | Stage source has no local code edits outside deployment artifacts. |
| Services | Backend, frontend, and database containers are running. |
| Health | Backend health endpoint and frontend route respond successfully. |
| Migrations | Migration status is clean for the deployed schema. |
| Environment | Relevant env flags are present and secrets are redacted. |
| Data-write scope | Whether the task permits creating or mutating Stage fixtures. |

If the deployed SHA is not the candidate under test, stop. Acceptance has not started.

## Exact Deployed SHA

The acceptance report must include the deployed commit SHA.

Acceptable evidence:

- `git rev-parse HEAD` from the Stage release directory;
- startup log line containing the release SHA;
- image label or deployment metadata containing the release SHA;
- application health/build metadata if the service exposes it.

Do not accept "latest", branch names, or local commit assumptions as proof.

## Stage Health

Check the runtime before testing business behavior:

- backend container status and restart count;
- frontend container status and restart count;
- database container status;
- backend `/health`;
- frontend route load;
- TLS certificate validity for public Stage URLs when applicable;
- backend logs since deployment for startup errors;
- frontend/browser console for fatal runtime errors.

Any persistent `5xx`, container restart loop, database connection error, migration error, or frontend bundle load failure blocks acceptance.

## Schema And Migrations

Stage migrations are explicit. Deploying code does not prove the schema is current.

For candidates with schema changes:

- list expected migration directories;
- run the accepted Stage migration procedure;
- verify migration status after `migrate deploy`;
- verify required schema objects exist when the feature depends on them;
- confirm no failed migration entries remain.

For candidates without schema changes:

- verify migration status is clean;
- state that no new migration was expected.

Never fabricate schema objects manually for acceptance.

## Canonical Accounts

Runtime acceptance uses canonical Stage-only accounts. Passwords must not be committed, printed in reports, or copied from Production.

At minimum, Contract Context acceptance requires:

| Account type | Purpose |
| --- | --- |
| Client admin | Client-owned visibility, acceptance, comments, attachments, notifications. |
| Primary provider admin | Primary management visibility and assignment authority. |
| Primary master | Primary operational management checks. |
| Primary dispatcher | Primary dispatch and assignment checks. |
| Primary technician | Direct executor work and claim checks. |
| Secondary provider admin | Secondary visibility, request assignment, internal workforce checks. |
| Secondary master | Secondary management visibility. |
| Secondary dispatcher | Secondary dispatch visibility. |
| Secondary technician | Secondary executor work, request assignment, claim denial/exception checks. |
| Mobile technician | Mobile login, ticket list, detail, comments, attachments, completed tickets. |

For every account, record:

- login/email;
- role;
- company;
- company type;
- contract context used;
- location bindings;
- specialization bindings;
- login result;
- `GET /auth/me` or equivalent identity check.

## Role Matrix

The role matrix is tested from the current permissions and access model, not from assumptions.

Use [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md) as the capability reference and [03 Access Model](03_ACCESS_MODEL.md) as the access rule reference.

Every role in scope should have:

- one positive case where the operation should work;
- one negative case where the role or scope must deny;
- available action metadata checked when the UI exposes an action;
- actual API mutation checked when the action mutates state.

## Ticket Fixtures

Contract Context acceptance uses clearly named Stage fixtures rather than permanent ids.

The model fixture set is:

| Fixture | Purpose |
| --- | --- |
| A | Valid primary-provider work. |
| B | Valid secondary-provider assigned work. |
| C | Valid secondary-provider unassigned work. |
| D | Wrong-location negative case. |
| E | Wrong-specialization negative case. |
| F | `AWAITING_ACCEPTANCE` ticket for client acceptance. |
| G | `IN_PROGRESS` assigned secondary-technician ticket for completion. |
| H | Client-created secondary-visible ticket where direct secondary claim is denied. |
| I | Secondary-technician self-created ticket where claim exception is allowed. |

The acceptance report may include actual ticket numbers and ids as evidence, but those ids are not product rules. If fixtures are recreated, the same semantic labels must be preserved.

Negative fixtures must fail by only the intended dimension. For example, a wrong-location ticket should still have a valid specialization, and a wrong-specialization ticket should still have a valid location.

## Positive Cases

Run positive cases through the actual contour affected by the release.

Contract Context acceptance should cover:

- client ticket visibility;
- primary provider visibility;
- secondary provider visibility;
- multi-contract provider role resolution;
- ticket detail;
- comments;
- attachments;
- history/timeline;
- assignment candidates;
- assignment and reassignment;
- request assignment;
- claim where allowed;
- start work;
- completion to `AWAITING_ACCEPTANCE`;
- client acceptance to `DONE`;
- rejection back to `IN_PROGRESS`;
- completed-ticket visibility;
- push recipient eligibility when push is in scope;
- MAX notification regression when MAX is in scope;
- desktop management contour;
- mobile contour.

## Negative Cases

Negative checks are mandatory for access and workflow changes.

Cover:

- wrong contract;
- wrong location;
- wrong specialization;
- unrelated provider;
- inactive or expired contract;
- revoked or invalid relationship context;
- direct ticket detail by id when list visibility denies;
- assignment candidate who cannot actually be assigned;
- foreign provider workforce visible to secondary provider;
- secondary direct claim on client-created or primary-created work;
- provider acceptance attempt;
- provider `AWAITING_ACCEPTANCE -> DONE` attempt;
- completion without required work report media;
- completion without required comment;
- notification candidate without readable ticket access;
- stale or hidden UI action followed by direct API mutation.

A negative case must prove both outcome and state preservation. A denied mutation should leave the ticket unchanged.

## Actual API Mutation Checks

UI acceptance alone is not enough for sensitive mutations.

For each mutation in scope, capture:

- request contour and account;
- endpoint and method;
- linked client or contract context parameters when used;
- expected HTTP status;
- response body summary;
- resulting ticket status or assignment state;
- timeline/domain event created, if expected;
- absence of state change when denied.

For Contract Context work, compare:

```text
candidate list
==
actual assignment authority
```

No candidate may appear if assigning that candidate would fail because of contract, location, specialization, provider relationship, active-user, or executor rules.

## Available Actions

`availableActions` is an important runtime contract between backend and clients.

For every ticket action in scope, verify:

- allowed action is shown when the backend allows it;
- forbidden action is hidden or disabled;
- direct API call is still denied when a hidden action is forged;
- provider users do not receive `canAccept=true`;
- client acceptance actors receive acceptance actions only on `AWAITING_ACCEPTANCE`;
- completion hints do not replace backend evidence checks.

The UI must not treat `availableActions` as authorization proof. Backend mutation services must re-check.

## Backend Log Scan

After each scenario block, scan backend logs for:

- unhandled exceptions;
- `500` responses;
- authorization stack traces;
- Prisma validation or constraint errors;
- migration/runtime schema errors;
- notification delivery errors;
- push errors when push is in scope;
- MAX errors when MAX is in scope;
- repeated retry loops.

Expected authorization denials should be clean `403` or `404` responses with no stack traces.

## 500 Detection

Any unexpected `500` in a path touched by the candidate is a failure until explained.

Record:

- timestamp;
- account;
- request path;
- response status;
- backend log excerpt;
- whether data changed.

If the `500` is unrelated to the candidate, classify it explicitly and decide whether it blocks release with the release manager.

## Evidence Format

Use one row per scenario:

| Field | Meaning |
| --- | --- |
| Scenario id | Stable semantic id, for example `SECONDARY_WRONG_SPECIALIZATION_DENY`. |
| Account | Stage account login, no password. |
| Role/company | Runtime role and company type. |
| Fixture | Semantic fixture label and ticket number/id used as evidence. |
| Contour | Desktop, mobile, backend API, push, MAX. |
| Action | Read, mutation, available action, notification, or log scan. |
| Expected | Expected status, visibility, action flag, event, or notification. |
| Actual | Actual runtime result. |
| Evidence | HTTP status, screenshot, log line, response field, DB read-only check. |
| Result | PASS, FAIL, or BLOCKED. |

Do not include passwords, tokens, private keys, or full environment dumps.

## PASS Criteria

Runtime acceptance is PASS only when:

- deployed SHA equals the candidate SHA;
- Stage health is clean;
- migrations are applied and verified when required;
- canonical accounts can log in;
- positive cases pass;
- negative cases fail closed;
- available actions match backend mutation behavior;
- no unexpected `500` exists in tested paths;
- backend logs show no unexplained runtime errors;
- evidence is sufficient to reproduce the conclusion;
- Production was not touched unless explicitly authorized by the task.

## FAIL Criteria

Runtime acceptance is FAIL when:

- the candidate is deployed but a required positive case fails;
- a forbidden action succeeds;
- a hidden or forged action can mutate state;
- a direct API call bypasses contract, location, or specialization scope;
- candidate list contains an unassignable executor;
- provider completion can become client acceptance;
- notification delivery leaks ticket data to a recipient without readable access;
- completed tickets disappear for an authorized actor;
- unexpected `500` responses remain unexplained.

## BLOCKED Criteria

Runtime acceptance is BLOCKED when testing cannot proceed safely or conclusively:

- deployed SHA cannot be confirmed;
- required Stage accounts or fixtures are missing;
- Stage health is not stable;
- migrations are unknown or failed;
- credentials are unavailable through the approved Stage-only source;
- the task forbids required data mutation;
- external delivery infrastructure is unavailable and no approved harness exists.

Blocked is not PASS. The report must state the blocker and the next concrete step.
