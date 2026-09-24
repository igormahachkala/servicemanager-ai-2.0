# 12 Release Process

> **Заменено. Порядок ветвления и доставки кода определяют skill, не этот документ.**
>
> - `skills/sma-code-delivery/SKILL.md` — ветвление и работа над задачей
> - `skills/sma-deploy-stage/SKILL.md` — проверки, PR в `beta`, развёртывание на Stage, приёмка
> - `skills/sma-deploy-prod/SKILL.md` — проверки, PR в `prod`, развёртывание в Production, откат
> - `skills/sma-agent-setup/SKILL.md` — подготовка машины: ssh и `gh`
> - `skills/_shared/secrets.md` — переменные окружения и секреты
>
> Разделы ниже описывают порядок, действовавший до введения ствола: веток
> `prod` и `beta` в нём нет, доставка кода допускалась мимо `origin`.
> При расхождении с skill верны skill. Документ сохранён как история
> и как источник наборов проверок.

This document describes the accepted delivery path from local work to Production.

Production is live. Production deployment, migration, data changes, and rollback require explicit authorization from the owner or release manager.

## Release Path

The standard release path is:

```text
Local
-> tests
-> integration candidate
-> Stage deploy
-> Stage migrate deploy
-> Stage runtime acceptance
-> backup
-> Production deploy
-> Production migrate deploy
-> smoke
-> monitoring
-> rollback readiness
```

Do not skip gates. A release candidate is not ready for Production because it builds locally; it is ready only after Stage runtime acceptance and release authorization.

## Release Invariants

- Deploy only from a clean, reproducible commit.
- Do not deploy from a dirty working tree.
- Do not deploy from a server-local hotfix.
- Do not use branch names as release identity; record exact SHAs.
- Stage migrations are explicit and must be verified or applied.
- Production migrations require explicit authorization.
- Rollback must be prepared before Production deploy.
- Production database rollback is not assumed to be destructive.
- Secrets and environment values are not committed and are not printed in reports.
- Stage and Production are separate operational contours.

## 1. Local

Local work happens in a dedicated task worktree.

Minimum local precheck:

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git worktree list
```

Before committing, run checks that match the changed surface:

- backend build and tests for backend changes;
- Prisma validate/generate for Prisma or schema-adjacent backend changes;
- frontend build and focused frontend tests for web/mobile changes;
- focused regression tests for the changed behavior;
- `git diff --check` for whitespace.

The commit must be focused on the task. Do not include unrelated files.

## 2. Tests

Tests are selected by blast radius.

| Change area | Expected checks |
| --- | --- |
| Backend business logic | focused backend tests, full backend Jest, backend build |
| Access or authorization | positive and negative access tests, direct API mutation checks |
| Prisma schema | Prisma validate, generate, migration sanity, backend build |
| Frontend | TypeScript/build, focused UI tests where available |
| Mobile | mobile RC or mobile-focused regression |
| Browser storage | browser-storage tests, login/session/logout paths |
| Notifications | recipient eligibility tests, push/MAX regression where relevant |
| Release integration | backend build, frontend build, full backend tests, migration audit |

Automated tests are necessary but do not replace runtime acceptance.

## 3. Integration Candidate

An integration candidate collects accepted task commits into one reproducible line.

For every candidate, record:

- base SHA;
- included commits in order;
- excluded commits;
- conflict resolutions;
- files changed;
- migration state;
- final candidate SHA;
- local test results.

Integration is not a place to add new features. Conflict cleanup must preserve every included feature and must not silently rewrite business rules.

Before Stage deploy:

- verify `git status --short` is clean;
- run `git diff --check`;
- verify expected migrations are present;
- verify no unexpected migrations were added or removed;
- verify no secrets or Production config entered the diff.

## 4. Stage Deploy

Stage deploy validates the candidate in the deployed environment.

Before deploy, record:

- current Stage HEAD;
- target candidate SHA;
- Stage worktree path;
- current container status;
- current health;
- services expected to rebuild;
- whether schema changes exist.

Deploy from the clean integration candidate. Rebuild backend and frontend images when their code changed. Frontend changes require image rebuild because the Stage web container serves built static output.

Do not change Stage environment variables unless the task explicitly authorizes it.

## 5. Stage Migrate Deploy

Stage migrations are not implicit.

If the candidate contains migrations:

1. list expected migration directories;
2. verify current Stage migration status;
3. run the accepted Stage `prisma migrate deploy` procedure;
4. verify migration status again;
5. verify required schema objects where practical;
6. scan backend logs after restart for schema/runtime errors.

If the candidate has no migrations, state that no Stage migration was expected and still verify migration status is clean.

Do not create schema objects manually to make Stage pass.

## 6. Stage Runtime Acceptance

Run [11 Runtime Acceptance](11_RUNTIME_ACCEPTANCE.md) after Stage deploy and Stage migration verification.

Acceptance must use:

- exact deployed SHA;
- canonical Stage accounts;
- semantic ticket fixtures;
- positive cases;
- negative cases;
- role matrix checks;
- actual API mutation checks;
- `availableActions` checks;
- backend log scan;
- `500` detection.

A Stage acceptance PASS must include enough evidence for another engineer to understand what was tested and why the result is safe.

## 7. Backup

Before Production deploy, confirm backup readiness.

Database backup evidence should include:

- procedure name or command;
- backup destination;
- permissions;
- available disk space;
- expected backup duration;
- validation method;
- restore/rollback estimate.

Application backup evidence should include:

- current Production SHA;
- release directory or image snapshot;
- environment snapshot policy with secrets redacted;
- rollback target SHA;
- rollback command sequence.

Do not start Production deploy if backup and rollback readiness are unknown.

## 8. Production Deploy

Production deploy requires explicit authorization.

Before deploy, record:

- owner/release-manager authorization;
- current Production HEAD;
- target candidate SHA;
- clean source path;
- current containers and restart counts;
- current health;
- current migration status;
- backup confirmation;
- rollback target and rollback path;
- services to rebuild/restart;
- services that must remain untouched.

Deploy only the authorized candidate. Do not deploy extra local commits. Do not deploy from a dirty `/opt` worktree.

## 9. Production Migrate Deploy

Production migrations require explicit authorization and backup confirmation.

Rules:

- run migrations only when the candidate contains required migrations;
- use `prisma migrate deploy`, not manual schema edits;
- verify migration status after deploy;
- do not remove enum values or migration history destructively during rollback;
- if forward schema compatibility is required for rollback, verify it before deploy;
- stop on failed migration and report the exact error.

Production code and schema must be compatible at every step in the chosen deploy order.

## 10. Smoke

Production smoke verifies that the deployed release is alive and that critical paths still work.

Minimum smoke:

- backend health;
- frontend route load;
- login with approved smoke account or safe auth probe;
- `GET /auth/me` or equivalent identity check;
- management board/list loads;
- ticket detail loads;
- mobile shell loads when mobile was touched;
- notifications/push/MAX smoke only if those areas were touched and safe credentials exist;
- backend logs show no unexpected `500` or startup errors.

Do not create or modify customer data unless the Production task explicitly authorizes it.

## 11. Monitoring

After deploy, monitor:

- container restarts;
- backend error rate;
- `500` responses;
- Prisma errors;
- migration/schema errors;
- auth/session errors;
- notification/push/MAX delivery errors when relevant;
- frontend console/runtime errors;
- user-reported regressions.

The monitoring window depends on release risk. P0 stabilization releases require active log review immediately after deploy.

## 12. Rollback

Rollback must be prepared before deploy.

Rollback preparation includes:

- rollback target SHA;
- clean rollback worktree or image;
- expected services to rebuild/restart;
- database forward-compatibility decision;
- migrations that must remain applied;
- migrations that are safe to ignore by old code;
- smoke checks after rollback;
- estimated rollback time.

Application rollback is preferred when the schema changes are additive and forward-compatible.

Do not perform destructive database rollback, enum deletion, migration-history deletion, or manual data mutation unless explicitly authorized by the owner and verified by a separate rollback plan.

## Release Checklist

### Candidate

- [ ] Base SHA recorded.
- [ ] Included commits listed.
- [ ] Excluded commits listed.
- [ ] Conflicts resolved by behavior, not by dropping features.
- [ ] Working tree clean.
- [ ] `git diff --check` clean.
- [ ] No secrets in diff.
- [ ] Migration audit complete.
- [ ] Backend checks complete when backend changed.
- [ ] Frontend checks complete when frontend changed.

### Stage

- [ ] Current Stage HEAD recorded.
- [ ] Target Stage HEAD recorded.
- [ ] Backend rebuild complete when backend changed.
- [ ] Frontend rebuild complete when frontend changed.
- [ ] Stage health clean.
- [ ] Stage migrations verified or applied explicitly.
- [ ] Runtime acceptance complete.
- [ ] Backend logs scanned.
- [ ] `500` detection complete.
- [ ] Remaining blockers listed.

### Production Gate

- [ ] Explicit authorization obtained.
- [ ] Production current HEAD recorded.
- [ ] Target SHA recorded.
- [ ] Backup readiness confirmed.
- [ ] Rollback candidate prepared.
- [ ] Rollback time estimated.
- [ ] Migration plan approved.
- [ ] Environment changes approved or declared unnecessary.
- [ ] Production services to touch are listed.
- [ ] Production services to avoid are listed.

### Production Post-Deploy

- [ ] Current Production HEAD matches target.
- [ ] Backend health passes.
- [ ] Frontend health passes.
- [ ] Migration status clean.
- [ ] Smoke checks pass.
- [ ] Logs show no unexpected errors.
- [ ] Monitoring window started.
- [ ] Rollback remains available until release is accepted.

## Stop Conditions

Stop and report BLOCKED when:

- target SHA cannot be verified;
- worktree is dirty with unrelated changes;
- migrations are failed or ambiguous;
- backup or rollback readiness is unknown before Production;
- Stage acceptance failed;
- Production authorization is absent;
- a required secret or credential is missing;
- a deployment step would touch a forbidden service or environment.
