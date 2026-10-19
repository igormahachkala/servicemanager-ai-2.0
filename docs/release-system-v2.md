# Release System V2

Status: implementation candidate. GitHub enforcement and canonical protocol activation require a separate OWNER GO.

## Why V1 blocks delivery

The trusted `pull_request_target` workflow currently requires `stage-busy` for every PR into `beta` or `prod`. A missing lock is a normal state while a PR is being reviewed, but V1 treats it as an admission failure. At the same time, both protected branches require one CODEOWNER approval and the only CODEOWNER is the account used by the AI agents, so GitHub's self-approval rule creates a governance deadlock.

The current protections also require only `Release lane gate`; the four release-automation CI jobs are not branch requirements. The active tag ruleset has an administrator-role bypass, which is wider than the release protocol intends.

## Exact settings delta

| Setting | Current | V2 target |
| --- | --- | --- |
| `beta` approvals | 1 approval, CODEOWNER review, last-push approval | 0 approvals, no CODEOWNER review requirement |
| `prod` approvals | 1 approval, CODEOWNER review, last-push approval | 0 approvals, no CODEOWNER review requirement |
| Required checks | only `Release lane gate` | four CI jobs + `Release lane gate` + source-bound independent review + contour admission |
| Gate meaning | PR verification and release-lock admission combined | lock-free verification; separate Stage and Production admission |
| Direct/force push | blocked | remains blocked, administrators enforced |
| Release-tag bypass | repository administrator role may bypass | no ordinary bypass; dedicated release-manager identity only if operationally required |
| Production authorization | PR approval plus environment | exact Production admission plus owner-reviewed environment |

The four CI contexts are `Shell quality`, `A1-A7 self-tests`, `Protocol regression`, and `A4 Prisma integration`. `beta` additionally requires `Stage admission`; `prod` requires `Production admission` instead.

## V2 trust model

V2 separates three decisions. None of them grants deployment permission by itself.

| Phase | Trigger | Required evidence | Result |
| --- | --- | --- | --- |
| PR verification | `pull_request_target` | exact repository/base/head/merge identity, beta contains prod, CI, SHA-bound independent review | `Release lane gate` check |
| Stage admission | protected manual dispatch | PR verification evidence plus an annotated, canonical, owned `stage-busy` | `Stage admission` check on the exact candidate SHA |
| Production admission | protected `production` environment dispatch | Stage evidence, exact `stage_tree`, owned `stage-busy` and `prod-busy`, owner identity, candidate/tree equality | `Production admission` check on the exact candidate SHA |

The workflows check out only the default branch. They never check out or execute code from the pull request, perform no deployment or database operation, and fail closed on API or Git errors. Checks are emitted by a dedicated Release Gate GitHub App, not the shared GitHub Actions identity. Its private key is the only secret reference and must live in protected `release-governance` and `production` environments.

## Independent technical review

An Agent 2 chat verdict is not independently attestable while it is posted through the same GitHub owner identity used by Agent 1. V2 therefore requires one check named `Independent technical review`, bound to the exact candidate SHA and emitted by a dedicated GitHub App ID configured in `INDEPENDENT_REVIEW_APP_ID`.

The app must authenticate independently, have only `checks:write` and repository metadata read access, and publish a completed successful check only after the reviewed SHA is immutable. A comment, label, owner-authored check, copied JSON, or same-name Actions job is not accepted. Until this app exists, enforcement activation is BLOCKED; the system must not imitate an independent approval.

The Release Gate App is a separate identity with repository metadata, pull-request read and check-run write permissions. Its App ID is the required-check source. `RELEASE_GATE_APP_ID` is a variable; `RELEASE_GATE_APP_PRIVATE_KEY` is environment-scoped. Repository-wide exposure would allow an untrusted same-repository workflow to spoof admission and is prohibited.

## Proposed branch settings

### beta

- Require pull requests and conversation resolution.
- Required approvals: `0`; CODEOWNER approval is not a Stage security boundary.
- Require strict, source-bound checks: the four release CI checks, `Release lane gate`, `Independent technical review`, and `Stage admission`.
- Require branches to be up to date, enforce administrators, reject force-push and deletion.
- No user, administrator-role, or ordinary GitHub App bypass.

### prod

- Require pull requests and conversation resolution.
- Required approvals: `0`; owner GO is enforced by the protected Production environment and `Production admission` check.
- Require strict, source-bound checks: the four release CI checks, `Release lane gate`, `Independent technical review`, and `Production admission`.
- Enforce administrators and reject force-push and deletion.
- No ordinary bypass.

### Tags and environment

- Protect `stage-busy`, `prod-busy`, and `stage-ok/*` against deletion and non-fast-forward updates.
- Replace the current repository-role bypass with a dedicated release-manager GitHub App or narrowly scoped team. Emergency access is time-limited, owner-approved, and audited.
- Keep the `production` environment restricted to `prod`, with required owner review, no administrator bypass, and `RELEASE_OWNER_LOGIN` configured as a repository variable.

## Bootstrap order

1. Provision separate independent-review and Release Gate GitHub Apps and record their immutable App IDs.
2. Create a `release-governance` environment restricted to trusted release refs, with no deployment capability. Store the Release Gate private key only there and in the owner-reviewed `production` environment.
3. Set `INDEPENDENT_REVIEW_APP_ID`, `RELEASE_GATE_APP_ID`, and `RELEASE_OWNER_LOGIN` repository variables.
4. Merge only the trusted workflow, V2 scripts, tests, and CODEOWNERS entries into the default branch `main` through a reviewed bootstrap PR.
5. Install the same files in `beta` and `prod`; do not enable new required checks yet.
6. Run a harmless same-repository PR through PR verification. Acquire a real canonical lock only for a real Stage admission and verify the SHA-bound admission check.
7. Verify Production admission on a real owner-approved release through the protected environment.
8. Add source-bound required checks to `beta`, then prove a canonical Stage merge.
9. Add source-bound required checks to `prod`, then prove Production merge and `prod -> beta` reconciliation.
10. Remove the mandatory GitHub approval rules only after the replacement checks are observed on exact SHAs.
11. Remove the broad tag bypass last.

Same-branch follow-up remains valid because lock ownership is the original release branch, while every new head SHA must receive fresh CI, review, verification, and admission checks.

## Rollback

Before changing settings, export branch protection, rulesets, environments, variables (names only), required checks and bypass actors to timestamped owner-only JSON files. If a valid release cannot progress:

1. Stop dispatching admissions; do not alter release tags.
2. Restore the previous source-bound required-check lists through the GitHub API.
3. Restore branch review settings, rulesets, bypass actors and environment policy from the snapshots.
4. Confirm direct push, force-push and deletion remain blocked.
5. Run governance checks in post-enforcement mode and record the rollback evidence.

Rollback never disables all protection, changes application branches, deploys code, or mutates a database.

## Remaining race boundary

The gate revalidates GitHub metadata and remote refs around evaluation. GitHub branch protection must still require strict checks on the exact head and current base at the merge point. A successful check is evidence for one immutable SHA, not authorization for a future head, changed base, deployment, or lock state.
