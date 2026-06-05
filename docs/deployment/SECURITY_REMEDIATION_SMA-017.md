# SMA-017.1 — Security Remediation Report

**Date:** 2026-06-03  
**Priority:** P0 / CRITICAL  
**Baseline target:** Repository Security Baseline V1

## Summary

| Item | Status | Notes |
|------|--------|-------|
| Repository private | **MANUAL** | Run `scripts/github-security-setup.sh` after `gh auth login` |
| Secrets rotated | **MANUAL** | Operator must rotate on all runtimes (see checklist) |
| Env files untracked | **DONE** (local commit pending) | `backend/.env.docker`, `backend/.env.test` removed from index |
| `.gitignore` hardened | **DONE** | `.env`, `.env.*`, `!.env.example` |
| Dependabot | **DONE** | `.github/dependabot.yml` |
| CI workflow | **DONE** | `.github/workflows/ci.yml` |
| Branch protection | **MANUAL** | Via script or GitHub UI |
| Secret scanning / push protection | **MANUAL** | GitHub Settings (org/plan dependent) |
| 2FA for collaborators | **MANUAL** | Organization policy |

**Overall:** **PARTIAL PASS** until GitHub settings + secret rotation + history purge are confirmed.

---

## 1. What was changed (repository)

### `.gitignore`
- Ignore all `.env` and `.env.*`
- Allow only `!.env.example`
- Added `.qa-tmp/` (runtime QA artifacts may contain tokens)

### Removed from Git tracking (files remain locally)
- `backend/.env.docker`
- `backend/.env.test`

### Kept (sanitized template only)
- `backend/.env.example` — placeholders only, no production values

### Added
- `.github/dependabot.yml` — weekly npm updates for `backend/` and `web/`
- `.github/workflows/ci.yml` — backend install / prisma generate / build / test; web install / build
- `scripts/github-security-setup.sh` — private repo, secret scanning flags, branch protection
- This report

---

## 2. Secrets rotation checklist (operator action)

Rotate **all** credentials that may exist in Git history or shared env files. After rotation, invalidate old values everywhere (VPS Docker env, local `.env`, CI secrets).

| Secret | Where used | Action |
|--------|------------|--------|
| `MAX_BOT_API_TOKEN` | Production/stage backend, MAX platform | Regenerate in MAX; update server env; restart `sma_backend` |
| `JWT_SECRET` | All API instances | New random 64+ char secret; **invalidates all sessions** |
| `DATABASE_URL` / DB password | Postgres containers | Change `POSTGRES_PASSWORD`; update `DATABASE_URL`; migrate connections |
| `PLATFORM_ADMIN_PASSWORD` | Seed/bootstrap | Change in DB + env; do not reuse example password |
| `MAX_BOT_WEBHOOK_SECRET` | Webhook mode | Regenerate if webhook enabled |
| Deploy/SSH keys | VPS `194.67.101.37` | Rotate if ever stored in repo or chat |
| Stage QA `StageQa123!` | Stage only | Change if repo was public |

**Not rotated by automation in this task** — no access to production secret stores.

---

## 3. Exposed in Git history (known)

Historical commits may still contain:

- `backend/.env.docker` — `JWT_SECRET`, `PLATFORM_ADMIN_PASSWORD`, `DATABASE_URL`
- `backend/.env.test` — `JWT_SECRET`, test `DATABASE_URL`
- `docker-compose.yml` / docs — demo passwords (`sma_password`, `change_me`) — low risk but rotate for production parity

**Recommended follow-up (P0):**

1. Confirm repo is **private** immediately.
2. Use [GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning) alerts.
3. If repo was ever public: consider `git filter-repo` / BFG to purge secrets from history, then force-push (coordinate with team).

---

## 4. Branch protection

**Target (`main`):**
- Require pull request before merge
- Require status checks: `Backend`, `Web`
- No direct push (except admins if configured)
- No force push

**Apply:**
```bash
chmod +x scripts/github-security-setup.sh
gh auth login
./scripts/github-security-setup.sh
```

---

## 5. CI status

Workflow: `.github/workflows/ci.yml`

| Job | Steps |
|-----|--------|
| Backend | `npm ci` → `prisma generate` → `npm run build` → `npm test` |
| Web | `npm ci` → `npm run build` |

**Local note:** On `codex-mobile-phase`, backend `npm run build` may fail due to unrelated TS errors; CI will reflect that until fixed.

---

## 6. GitHub security features (manual)

1. **Settings → General → Danger zone** → Change visibility to **Private**
2. **Settings → Code security** → Enable **Secret scanning** and **Push protection** (if available on plan)
3. **Settings → Branches** → Add rule for `main` (or use script)
4. **Organization → Authentication** → Require **2FA** for all members

---

## 7. Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Secrets in Git history | **Critical** | History rewrite or treat as compromised; rotate all |
| `gh` not authenticated in automation | High | Operator runs setup script |
| Demo passwords in `docker-compose*.yml` | Medium | Use env substitution; separate prod compose |
| `.qa-tmp/` local artifacts | Medium | Now gitignored; delete local copies with tokens |
| Backend build red on branch | Low | Fix TS errors so CI build passes |
| No automated deploy secret injection | Medium | Use GitHub Environments / VPS secret files outside Git |

---

## 8. Verification commands

```bash
# No tracked env files except example
git ls-files | grep -E '\.env' || true
# Expected: backend/.env.example only

# GitHub visibility (after gh auth)
gh repo view igormahachkala/servicemanager-ai-2.0 --json visibility,isPrivate
```

---

## Expected result

After operator completes GitHub settings + secret rotation:

**Repository Security Baseline V1 → PASS** (with documented history-purge as optional hardening).

Until then: **PARTIAL PASS** — repository hygiene and CI/Dependabot in place; runtime and GitHub org controls pending.
