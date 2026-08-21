# 04 Development Workflow

## Git Flow

The project runs many parallel tasks. Each task should use a dedicated worktree when the branch, base commit, or task boundary matters:

```bash
git worktree add -b fix/sma-my-task-001 /private/tmp/sma-my-task <base-commit>
cd /private/tmp/sma-my-task
```

State the base commit explicitly. Use the commit the task names, not a convenient local branch.

Remove the worktree when the task is done:

```bash
git worktree remove /private/tmp/sma-my-task
```

## Branch Naming

```text
feature/sma-<topic>-<NNN>       new functionality
fix/sma-<topic>-<NNN>           defect fix
integration/sma-<topic>-<NNN>   candidate assembled from several branches
audit/sma-<topic>-<NNN>         read-only audit
rollback/sma-<topic>-<NNN>      prepared rollback
docs/<topic>                    documentation
```

Commits follow Conventional Commits with a scope: `fix(tickets):`, `feat(access):`, `test(access):`, `docs(onboarding):`. Write the body to explain why the change exists, not to restate the diff.

## One Task = One Commit

One logical defect, feature, audit result, or docs integration is one commit unless the task explicitly says otherwise.

Problems found along the way are separate tasks, not additions to the current commit.

The reason is practical: releases are assembled by cherry-picking individual commits into integration branches. A commit that mixes an access fix with an unrelated layout tweak cannot be taken partially.

Add files explicitly:

```bash
git add backend/src/tickets/ticket-access.utils.ts
```

Avoid sweeping unrelated changes into the commit. If `git status --short` shows files you did not touch, stop and find out where they came from before committing.

## Start Every Task

From the repository root:

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git worktree list
```

Confirm the requested repository, branch, base commit, and worktree before editing.

## Local Development

Install dependencies as needed.

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
cd web
npm ci
npm run build
npm run lint
```

Useful frontend targeted checks:

```bash
cd web
npm run test:browser-storage
npm run test:mobile-rc
```

For schema work:

```bash
cd backend
npx prisma validate
npx prisma migrate dev
npm run prisma:generate
npm test
```

Use Prisma migrations for schema changes. Keep generated clients and migration state aligned before committing.

## Local To Stage To Production

The normal path is:

```text
Local implementation
-> automated checks
-> Stage deployment
-> runtime acceptance
-> Production deployment only when explicitly authorized
```

Local tests prove the code builds and expected checks pass. They do not replace runtime acceptance.

Stage validates the deployable build against Stage infrastructure and Stage data.

Production is live. Production work requires explicit authorization, current backup expectations, rollback readiness, and exact task boundaries.

## Stage

Stage is the acceptance contour, deployed from `docker-compose.stage.yml`:

- `sma_stage_backend`
- `sma_stage_web`
- `sma_stage_postgres`

The web image is built, not served live. `VITE_API_BASE_URL` is baked into the frontend image through a Docker build argument, and `vite preview` serves static output. A frontend change does not appear on Stage without rebuilding the image.

Stage migrations require explicit handling. If a task adds a migration, apply it on Stage through the accepted Stage deployment procedure. Do not fabricate schema objects manually.

Before runtime acceptance, verify:

- deployed candidate commit;
- container health;
- API health;
- web health;
- migration status;
- required schema objects when schema changed.

## Runtime Acceptance

Runtime acceptance answers: does this work for a real user in the deployed environment?

For user-facing behavior, verify the actual contour affected by the change:

- Management platform for desktop workflows.
- Mobile application for technician workflows.
- Backend API for authorization, workflow, and mutation behavior.

For sensitive authorization work, verify both:

- action discovery metadata returned to the frontend;
- actual backend mutation result.

Runtime acceptance should record:

- environment tested;
- exact user role tested;
- ticket or entity IDs used for evidence;
- console errors;
- network failures;
- API failures;
- unexpected authorization results;
- whether data writes were allowed by the task.

If the deployed code is not the candidate, acceptance has not run.

## Production Safety

Production tasks must follow the task restrictions exactly.

Before Production deployment, verify:

- current deployed HEAD;
- clean worktree;
- running containers;
- restart counts;
- API and web health;
- database readiness;
- migration status;
- backup requirement;
- rollback target;
- expected services to rebuild;
- services that must remain untouched.

During Production work:

- Do not change environment variables unless explicitly authorized.
- Do not run migrations unless the task and migration status require it.
- Do not modify data except through the exact allowed application workflow.
- Do not restart or rebuild services outside the task boundary.

After Production deployment, verify:

- deployed HEAD;
- application health;
- container status and restart counts;
- migration status;
- logs for the changed service;
- runtime acceptance result.

## Code Review

Beyond the obvious, this project looks for:

**Duplicated business rules.** A second copy of an access rule will diverge from the canonical one. Look for an existing helper before writing one.

**Cross-interface consistency.** Web, mobile, push, realtime, and MAX use one backend. A change that fixes only one interface may mean logic leaked into the client.

**Task boundaries.** An edit in another module while doing the current task is usually a separate task.

**Negative cases.** An access change without a test for who must not see or do something is under-covered.

**Runtime proof.** For authorization and workflow changes, a passing unit test is not enough when the task asks for runtime acceptance.

## Documentation Update Rule

When code changes alter current architecture, update the canonical numbered docs only if the change affects developer onboarding or accepted system rules.

Use:

- `02_ARCHITECTURE.md` for system structure and boundaries.
- `03_ACCESS_MODEL.md` for visibility, assignment, claim, acceptance, and notification eligibility.
- `04_DEVELOPMENT_WORKFLOW.md` for workflow, deployment, and verification process.
- `05_TESTING_AND_FIRST_TASK.md` for test expectations and the first onboarding exercise.

Do not create a new root entry point. If a reference is historical or no longer safe as active guidance, move it to `docs/LEGACY/` in a documentation task.

## Definition Of Done

A task is done when all applicable items are true:

- [ ] `git status --short` contains only intended changes.
- [ ] `git diff --check` is clean.
- [ ] Backend build passes when backend was touched.
- [ ] Backend tests pass when backend behavior was touched.
- [ ] Prisma validate and generate pass when backend schema or Prisma types are involved.
- [ ] Frontend build passes when frontend was touched.
- [ ] Focused tests cover the changed behavior.
- [ ] Negative cases cover denied access or hidden data where relevant.
- [ ] Runtime acceptance is complete when the task requires it.
- [ ] The commit is focused on one task.
- [ ] The final report states anything not verified.
