# Engineering Agent

Internal engineering tooling that lives inside the ServiceManager.AI repository and
runtime. This document exists so that nobody mistakes it for product functionality.

## What It Is Not

Read this section first. Every line is a distinction that has caused confusion.

- **Not a customer-facing FSM capability.** No client, provider, or technician ever
  sees it. It does not appear in any tenant workflow.
- **Not the AI Company project.** That is a separate initiative with its own planning
  material. The Engineering Agent predates it, shares no code with it, and must not be
  cited as its implementation.
- **Not the IT Company module.** The desktop IT Company UI is gated by
  `canViewITCompany` (strictly `PLATFORM_ADMIN`) and deliberately does **not** use the
  Engineering Agent's owner flag. The code says so explicitly in
  `web/src/it-company/access.ts`, which refers to the Engineering Agent screen as
  *legacy*.
- **Not part of Contract Context.** It has no contract, no location scope, no
  specialization scope, no provider/client relationship. Its authorization model is
  entirely separate and much simpler.
- **Not part of the ticket access model.** `AgentTask` is not a `Ticket`. None of the
  rules in [03 Access Model](../03_ACCESS_MODEL.md) apply to it.

## Purpose

A read-only code analysis worker. An owner creates an analysis task through a UI page;
an external worker picks it up, selects relevant project source files, runs a
read-only analysis through a **local** language model, writes the result back, and
marks the task complete.

It changes no product data and performs no writes outside its own `AgentTask` rows.

## Architecture

Three parts, only two of which are deployed.

```text
web/src/views/EngineeringAgentPage.tsx        UI, route /agents/engineering
        |
        v  HTTP
backend/src/agent-tasks/                      module, wired into AppModule
        |
        v  Prisma
AgentTask table                               migration 202606140001_add_agent_tasks
        ^
        |  HTTP polling  (separate process, NOT deployed)
agent-runner/                                 standalone package
        |
        v
local Ollama model                            on the operator's host
```

The runner is a **client** of the backend, not a service the backend calls. The backend
has no knowledge of the runner and no dependency on it. If the runner never runs, tasks
simply stay in `NEW`.

## Runtime Topology

| Component | Deployed | Where it runs |
|---|---|---|
| `EngineeringAgentPage` | yes | inside the web bundle |
| `backend/src/agent-tasks/` | yes | inside the backend process |
| `AgentTask` table | yes | application database |
| `agent-runner/` | **no** | manually, on an operator machine |
| Ollama model | **no** | locally, alongside the runner |

`agent-runner` appears in **no** Dockerfile, **no** compose file, and **no** CI
pipeline — the repository has no CI at all. It has its own `package.json`,
`tsconfig.json` and lock file, and is built and started by hand:

```bash
cd agent-runner
npm run build
npm run dry-run     # or: npm run live
```

Its only declared dependencies are `typescript` and `@types/node`, both dev-only. It
uses the Node built-in `fetch` to reach both the backend API and the local model.

## Security Model

### Backend

All five endpoints are protected by a **class-level** guard pair:

```ts
@UseGuards(JwtAuthGuard, EngineeringAgentGuard)
@Controller('agent-tasks')
```

`EngineeringAgentGuard` runs after JWT authentication and admits only Engineering Agent
owners. The rule lives in `backend/src/agent-tasks/agent-tasks.access.ts`:

```ts
if (user.role === UserRole.PLATFORM_ADMIN) return true
return engineeringAgentOwnerEmails().includes(email)
```

`engineeringAgentOwnerEmails()` reads the optional, comma-separated
`ENGINEERING_AGENT_OWNER_EMAILS` environment variable. **No email is hardcoded.** An
unset or empty variable means `PLATFORM_ADMIN` only — the default is the narrowest
possible, not the widest.

Refusal raises `ForbiddenException('Engineering Agent module is not available')`, which
is worded to avoid confirming that the module exists.

### Frontend

`/auth/me` returns a computed boolean:

```ts
canAccessEngineeringAgent: isEngineeringAgentOwner({ role: user.role, email: user.email })
```

`web/src/ui/Shell.tsx` uses it to decide whether the `/agents/engineering` navigation
entry is rendered. This is **visibility only** — the backend guard is the authority. A
user who reaches the route directly still gets nothing from the API.

### Who can access it

- Any user with role `PLATFORM_ADMIN`.
- Any user whose email appears in `ENGINEERING_AGENT_OWNER_EMAILS`.
- Nobody else, under any role, in any company.

There is no per-role fallback and no tenant-level grant. Engineering Agent access is
not part of the PBAC permission matrix and does not appear in
[08 Permissions Matrix](../08_PERMISSIONS_MATRIX.md).

## Backend API

Base path `/agent-tasks`. Every route carries the guard pair above.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/agent-tasks` | list tasks |
| `POST` | `/agent-tasks` | create a task |
| `GET` | `/agent-tasks/:id` | read one task |
| `PATCH` | `/agent-tasks/:id/status` | worker reports progress |
| `PATCH` | `/agent-tasks/:id/result` | worker writes the analysis result |

The two `PATCH` routes exist for the runner. They are not used by the UI.

## Data Model

```prisma
model AgentTask {
  id              String          @id @default(uuid())
  companyId       String
  createdByUserId String?
  title           String
  prompt          String
  status          AgentTaskStatus @default(NEW)
  result          String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdBy User?   @relation("AgentTaskCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@index([companyId, status])
  @@index([companyId, createdAt])
}

enum AgentTaskStatus { NEW  IN_PROGRESS  DONE  FAILED }
```

Introduced by migration `202606140001_add_agent_tasks`.

The `companyId` foreign key exists for tenancy hygiene, not for authorization — access
is decided by the owner check, not by company membership.

## agent-runner Behavior

Described by its own README as an MVP executor, read-only, HTTP API only.

1. Polls the backend for `AgentTask` rows with status `NEW`.
2. Selects relevant project source files using a code-aware context planner.
3. Runs a **read-only** analysis through a local Ollama model.
4. Writes the result back with a context manifest.
5. Marks the task `DONE`, or `FAILED` on error.

Source files of interest: `src/executor.ts`, `src/smaClient.ts`, `src/contextPlanner.ts`,
`src/fileSelector.ts`, `src/projectIndex.ts`, `src/taskModeDetector.ts`, `src/redact.ts`.
The presence of `redact.ts` indicates the pipeline is expected to strip sensitive
content before it reaches the model.

## Ollama Dependency

The runner uses a **local** Ollama model. No external AI API is called and no API key
leaves the host. This is stated in `agent-runner/README.md` and confirmed by its
`package.json`: the package declares no runtime dependencies at all — no AI SDK, no
HTTP client — and reaches both the backend and the model through Node's built-in
`fetch`.

Consequences worth knowing:

- The runner only works where Ollama is installed and a suitable model is pulled.
- There is no cloud dependency, no vendor account, and no per-token cost.
- Nothing about this dependency reaches the deployed backend — it exists only on the
  operator's machine.

## Deployment Status

**Backend module and UI page: deployed.** They ship with every build of the backend and
the web bundle, in every environment, including production. The endpoints exist and are
guarded; they simply have no eligible callers unless an owner is configured.

**Runner: not deployed anywhere.** It is a developer tool executed manually.

## Current Stage Usage

Measured on the Stage database:

| Status | Count | Last created |
|---|---|---|
| `DONE` | 3 | 2026-06-15 |

Three tasks, all completed, none since mid-June. The subsystem was exercised and has
been dormant since. It is not dead code — the path demonstrably ran — but it is not in
active use either.

## Removal — Why It Needs Its Own Task

Removal is not a cleanup commit. Five layers are coupled, and one of them cannot be
undone.

| Layer | What removal touches |
|---|---|
| Frontend | `EngineeringAgentPage`, the `/agents/engineering` route, the nav visibility branch in `Shell.tsx`, the `canAccessEngineeringAgent` field in the API type |
| Auth | `auth.service.ts` imports `isEngineeringAgentOwner` from the agent module to build `/auth/me`. **Auth depends on Engineering Agent**, not the other way round |
| Backend module | `AgentTasksModule` registration in `app.module.ts`, controller, service, guard, access rule, DTOs |
| Schema | `AgentTask` model, `AgentTaskStatus` enum, and two relations on `Company` and `User` |
| Migration | `202606140001_add_agent_tasks` — already applied everywhere. **Migrations move forward only**; dropping the table needs a new forward migration, and the historical one stays in the chain |

Additional constraints:

- The Stage table holds rows. Dropping it destroys them; that is a data decision, not a
  code decision.
- `ENGINEERING_AGENT_OWNER_EMAILS` may be set in environments outside this repository.
  Removing the code silently makes that variable meaningless rather than failing loudly.
- Removing `agent-runner/` alone leaves the backend serving an API with no consumer.
  Removing the backend module alone breaks the runner. **They are two halves of one
  feature and must be evaluated together.**

### If removal is ever decided

A dedicated deprecation task should proceed in this order, each step separately
verifiable:

1. Confirm with the owner that no environment relies on it, and export any `AgentTask`
   rows worth keeping.
2. Remove the navigation entry and the route — the feature becomes unreachable while
   everything still works.
3. Remove `canAccessEngineeringAgent` from `/auth/me` and from the frontend type,
   breaking the auth dependency.
4. Remove `agent-runner/`.
5. Remove the backend module and its registration.
6. Add a **new forward migration** dropping the table and enum. Do not delete the
   historical migration.

Steps 2 and 3 are reversible at no cost. Step 6 is not.

## Related Documents

- [09 Repository Guide](../09_REPOSITORY_GUIDE.md) — where these directories sit
- [03 Access Model](../03_ACCESS_MODEL.md) — the product access model this subsystem is **not** part of
- [08 Permissions Matrix](../08_PERMISSIONS_MATRIX.md) — the capability table this subsystem does **not** appear in
- [17 Decision Log](../17_DECISION_LOG.md) — why migrations are forward-only
