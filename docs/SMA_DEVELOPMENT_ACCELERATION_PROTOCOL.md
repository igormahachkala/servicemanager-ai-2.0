# SMA_DEVELOPMENT_ACCELERATION_PROTOCOL — DRAFT

> **Status: DRAFT / PROPOSAL.** This document does **not** replace or amend the active
> protocol (`skills/sma-deploy-stage`, `skills/sma-deploy-prod`, `skills/_shared/*`,
> `docs/12_RELEASE_PROCESS.md`, `docs/11_RUNTIME_ACCEPTANCE.md`). Nothing here is in
> force until the OWNER accepts it. It proposes **preflight and reporting automation
> around** the existing gates — it never removes a gate, a lock, or a human decision.

Goal: cut **Stage → Production** wall-clock time **without lowering safety**, by
scripting the repetitive, read-only preparation and verification work that currently
runs by hand, while keeping every state-changing and judgment step exactly where it is.

---

## 1. Current release protocol (as-is)

Delivery is strictly **Stage first, then Production**; no fast path.

- `sma-deploy-stage` — 14 steps: invariant `beta ⊇ prod` → area-map → publish → PR to
  `beta` → merge-checks on the trial-merge → contour verify → **lock + merge** → deploy
  → (migrations) → post-deploy reconciliation → acceptance → `stage-ok` tag → hold lock.
- `sma-deploy-prod` — 13 steps, gated on a live `stage-ok` and the `stage-busy` lock.
- Already scripted: `area-map.sh`, `merge-checks.sh`, `lock-acquire.sh`, `beta-audit.sh`,
  `skills-check.sh`.
- No CI/`.github/workflows`: everything runs locally or over `ssh` to the contour hosts.
- Locks are git tags (`stage-busy`/`prod-busy`); acceptance is `stage-ok/<branch>`;
  invariant `beta ⊇ prod` must hold before every release.

---

## 2. Observed bottlenecks (grounded in the Materials / Workforce / FC / MAX / Analytics prep cycles)

| # | Bottleneck | Evidence | Cost |
|---|---|---|---|
| B1 | **Prod-drift re-reconciliation.** Candidates prepared on prod N must be re-reconciled when prod advances before they reach Stage. | Prod advanced **6 times** in one working window (`f34e73a0→5bce8ba7→d2b2b22c→e22ddba0→cb80e429→8644e41e`). Workforce, FC, MAX each got **two** current-prod successors. | Highest. Repeated fetch→merge→conflict-check→delta-equivalence→tests→build→push per candidate per prod advance. |
| B2 | **Stale Prisma client / dep setup.** A fresh worktree has no `node_modules`; a moved schema (`FIELD_COMPLETE`) makes a reused client stale → build errors. | MAX/Workforce/FC prep each needed a local `node_modules` copy + `prisma generate`; stale client produced 12 phantom `TS` errors. | High. Minutes per candidate; easy to mistake stale-client errors for candidate defects. |
| B3 | **QA credential staleness at Stage acceptance.** No preflight; the authenticated smoke fails late, at acceptance. | Stage mobile smoke returned **401** (`tech@test.local`/stale seed password); authenticated role walk-through could not run. | Medium–High. Blocks acceptance after a full deploy; tempts ad-hoc credential resets. |
| B4 | **Manual SHA / overlap / delta verification.** Every prep repeats: confirm SHA, base, in-prod status, overlap with prod-delta, `reconciled delta == candidate delta`, migration check. | Done by hand in every Workforce/FC/MAX/Analytics prep. | Medium. Repetitive, error-prone, but deterministic → scriptable. |
| B5 | **Serial Stage lane + lock friction.** One candidate at a time; `would clobber existing tag` handling; a held `stage-busy` blocks the whole queue. | Mobile-Home release held the lane; `stage-busy` seen held across several later preps. | Medium. Queue stalls while a prior release awaits its Production decision. |
| B6 | **Manual Stage smoke.** `/_health`, `/m`, `/sw.js`, `/version`, log-error scan, browser role check — all by hand each release. | Repeated curl matrix in every Stage release. | Low–Medium. |
| B7 | **`merge-checks` backend set needs `backend/.env` (`DATABASE_URL`).** Absent → code 4, backend set unrunnable locally. | Documented gap; container-exec `prisma validate` is only a partial substitute. | Low–Medium. |

---

## 3. Repeated manual operations (automation candidates)

1. Fresh fetch + record prod/beta SHAs.
2. Confirm candidate SHA/branch on remote; in-prod / ancestor checks.
3. Overlap of candidate files vs the prod-delta and vs sibling candidates.
4. Reconcile onto current prod; confirm `reconciled delta == candidate delta`; conflict scan.
5. Migration/schema presence check.
6. Worktree dep setup + Prisma client refresh when schema drifts.
7. Focused + full test selection by area; builds; `git diff --check`.
8. `beta ⊇ prod` invariant check/restore.
9. QA credential reachability check before acceptance.
10. Stage runtime smoke (`/health`, `/`, `/m`, `/sw.js`, `/version`, log scan).
11. Production-readiness aggregation (stage-ok present, invariant, migration/DB-action gates).

---

## 4. Proposed automation (preflight & reporting only)

All proposed scripts are **read-only or idempotent**, produce a **report + exit code**,
and **feed** the existing skill steps — they never merge, deploy, tag, lock, or mutate.

- **A1 `reconcile-preflight.sh <candidate-sha> <contour>`** (B1, B4, B5).
  Fetch; print prod/beta SHAs; confirm candidate on remote; compute overlap vs prod-delta
  and vs other open candidates; dry-run merge onto current prod **and** beta; report
  conflicts, `delta == candidate` equivalence, and migration/schema presence. One command
  replaces the whole manual preflight block and flags *when* re-reconciliation is actually
  needed (skip it when prod didn't touch the candidate's files).
- **A2 `worktree-prep.sh`** (B2). Create the successor worktree, hydrate `node_modules`
  from a shared cache, and **`prisma generate` against the current schema** automatically
  when `schema.prisma` differs from the cache base. Removes stale-client false failures.
- **A3 `qa-preflight.sh <contour>`** (B3). **Read-only** probe: attempt a login with a
  designated QA account and report `200`/`401` **before** deploy, as a `prerequisites`
  item. Never resets or writes credentials.
- **A4 merge-check acceleration** (B7). Keep `merge-checks.sh`; add a documented
  `DATABASE_URL` source for local schema validation (or auto-fallback to the contour's
  `prisma validate` the skill already describes) so the backend set is never silently skipped.
- **A5 lock status classifier** (B5). Wrap `lock-acquire.sh` with a read-only `status`
  mode: who holds `stage-busy`/`prod-busy`, age, and whether the held branch is already in
  prod (lane effectively free) — surfaced, not acted on.
- **A6 `stage-smoke.sh <contour>`** (B6). Run the curl matrix (`/health`, `/`, `/m`,
  `/sw.js`, `/version`), scan backend logs since a mark, and emit a pass/fail **acceptance
  report** plus a **draft `stage-ok` body** for the human to confirm.
- **A7 `prod-readiness.sh <branch>`** (B5). Read-only aggregator: `stage-ok/<branch>`
  present and on the feat tip, `beta ⊇ prod`, migration gate, and any required DB/runtime
  actions (e.g. FC backfill, targeted RolePermission grant) with their runbook links.

---

## 5. Split: automate now / OWNER GO / never automate

### 5a. Automate now (read-only or idempotent; no outward effect; no gate removed)
- A1 reconcile-preflight (SHA/overlap/delta/conflict/migration reporting).
- A2 worktree-prep + Prisma client refresh.
- A3 QA-credential **read-only** preflight.
- A4 merge-check `DATABASE_URL` sourcing / documented fallback (checks already exist).
- A5 lock **status** classifier (read-only).
- A6 Stage smoke **report** generation (curl + logs; draft tag body).
- A7 Production-readiness **report** aggregation.
- `beta ⊇ prod` **check** (the read half of step 0).

### 5b. Requires explicit OWNER GO each time (state-changing / outward / hard to reverse)
- Merging a PR into `beta`; acquiring/holding/releasing a contour lock.
- Any server deploy (`up -d`, rebuild) on Stage or Production.
- Running migrations (`prisma migrate deploy`).
- **Backfill `--apply`** and any targeted DB grant (e.g. RolePermission INSERT).
- Creating/moving the `stage-ok` tag; the Production go/no-go.
- `beta ⊇ prod` **restore** (the write half of step 0) and `beta` reset.

### 5c. Never automate (human judgment / safety-critical)
- Acceptance-criterion judgment (does the change actually meet intent).
- Conflict-resolution semantics (how to merge overlapping changes).
- Destructive permission ops: `seed:permissions`, `rollback-permissions.ts`.
- Any **DB mutation without OWNER GO**; any **mass delete** of seeded/customer data.
- **QA/user credential resets**; touching `PLATFORM_ADMIN` or real users.
- Bypassing the lock, the `beta ⊇ prod` invariant, or the Stage-before-Prod order.
- Production go/no-go decision; `--apply` without separate authorization.

---

## 6. Expected time savings (per release, indicative)

| Area | Now (manual) | With A-scripts | Saved |
|---|---|---|---|
| Reconcile preflight + verify (B1,B4) | ~10–20 min, repeated per prod advance | ~1–2 min, one command; skipped when no overlap | ~8–18 min × each re-reconcile |
| Dep/Prisma setup (B2) | ~3–8 min + debugging stale client | ~1 min, auto-regenerate | ~5 min |
| QA preflight (B3) | failure discovered at acceptance (post-deploy) | caught in prerequisites | avoids a full wasted deploy cycle |
| Stage smoke + tag body (B6) | ~5–10 min manual curl/browser | ~1 min report | ~5 min |
| Readiness aggregation (B5,B7) | scattered manual checks | one report | ~5 min |

Largest win is **B1**: automated overlap detection avoids unnecessary re-reconciliation
entirely when prod did not touch the candidate's files, and makes the necessary ones fast.

---

## 7. Risks

- **False confidence in green reports.** A-scripts report; they must not be read as
  approval. Mitigation: reports state explicitly "preflight only — gates unchanged".
- **Automation drift vs the skills.** Scripts must call/quote the skill checks, not fork
  them. Mitigation: A-scripts live under `skills/_shared/scripts/` and reference the skill.
- **QA preflight credential handling.** Must be read-only and use a non-privileged QA
  account; never log or store the password. Mitigation: 5c forbids resets.
- **Dep cache staleness.** A shared `node_modules` cache can drift from lockfile.
  Mitigation: A2 verifies lockfile hash and regenerates the Prisma client per schema.
- **Over-automation creep.** Any step in 5b/5c migrating into 5a is a safety regression.
  Mitigation: this split is the contract; changes to it need OWNER GO.

---

## 8. Implementation priority

1. **A1 reconcile-preflight** + `beta ⊇ prod` check — biggest, lowest-risk win (B1,B4).
2. **A2 worktree-prep / Prisma refresh** — removes the most confusing failures (B2).
3. **A3 QA-credential preflight** — stops late acceptance failures (B3).
4. **A6 Stage smoke report** + **A7 prod-readiness** — standardize acceptance evidence (B6,B5).
5. **A5 lock status** + **A4 merge-check env** — queue visibility + backend-set reliability (B5,B7).

Each ships as a standalone read-only script with its own exit codes, reviewed before use;
none alters `sma-deploy-stage`/`sma-deploy-prod` behavior.
