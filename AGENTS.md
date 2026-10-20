# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Single deployable product: **ServiceManager.AI** — a multi-tenant (scoped by `companyId`) NestJS 11 + Prisma 5 REST API backend for field-service ticketing/dispatch. Code lives in `backend/`. PostgreSQL 16 is the only required datastore. Mobile/frontend, Redis, Nginx, monitoring in `docs/` are roadmap only — no code exists.

### Services
| Service | Required | How to run | Port |
| --- | --- | --- | --- |
| PostgreSQL 16 | yes | started via `pg_ctlcluster` (see below) | 5432 |
| NestJS backend API | yes | `cd backend && npm run start:dev` (watch) | 3000 |

Key endpoints: `/health`, `/api` (Swagger UI), `/auth/*`, `/users`, `/tickets`, `/technicians`, `/specializations`, `/problem-categories`, `/company`, `/analytics`. Standard dev curl examples are in `docs/DEV_COMMANDS.md`.

### Startup (Postgres is NOT auto-started; the update script does not start services)
PostgreSQL is installed natively (not Docker — Docker is unavailable in this VM). On a fresh VM boot the cluster is usually down; start it before running the API or tests:
```
sudo pg_ctlcluster 16 main start   # idempotent; ignore "already running"
```
DB role/databases already exist (created during setup, persisted in the snapshot): role `sma_user` / password `sma_password`, databases `sma_db` (dev) and `sma_test_db` (e2e). Recreate only if missing:
```
sudo -u postgres psql -c "CREATE ROLE sma_user LOGIN PASSWORD 'sma_password' CREATEDB;"
sudo -u postgres createdb -O sma_user sma_db
sudo -u postgres createdb -O sma_user sma_test_db
```

### Environment variables
The app reads `process.env` directly (no `ConfigModule`). Prisma Client auto-loads `backend/.env`, which is git-ignored and already present in the snapshot:
```
DATABASE_URL="postgresql://sma_user:sma_password@localhost:5432/sma_db"
JWT_SECRET="supersecret_change_me"
PORT=3000
```
Gotcha: an inherited `DATABASE_URL` in the shell environment overrides `backend/.env`. If you export `DATABASE_URL` (e.g. to run e2e against `sma_test_db`), `unset` it before starting the dev server or it will connect to the wrong database.

### Database migrations (run once against a fresh DB; not in the update script)
```
cd backend && npx prisma migrate deploy
```

### Run the API
```
cd backend && npm run start:dev
```
There is no seed script — create the first user via `POST /auth/register` (`companyName`, `email`, `password`; the creator becomes ADMIN, and a Company is created). Emails are stored lowercased.

### Lint / test caveats (pre-existing, do NOT "fix" as part of unrelated work)
- `npm run lint` runs `eslint --fix` and **mutates tracked source files**. To check lint without editing files, run `npx eslint "{src,apps,libs,test}/**/*.ts"` from `backend/`. The repo currently has ~99 pre-existing eslint errors (strict `no-unsafe-*` rules) — this is the baseline, not something you broke.
- `npm run test` (Jest unit): the only spec, `src/app.controller.spec.ts`, is a stale NestJS starter test and **fails** at baseline (`AppController` now depends on `PrismaService` and has no `getHello()`).
- E2E (`backend/test/app.e2e-spec.ts`) is the real integration suite. The npm `test:e2e*` scripts depend on Docker (unavailable here). Run it directly against the native Postgres instead:
  ```
  cd backend
  DATABASE_URL="postgresql://sma_user:sma_password@localhost:5432/sma_test_db" npx prisma migrate deploy
  DATABASE_URL="postgresql://sma_user:sma_password@localhost:5432/sma_test_db" JWT_SECRET="test_secret_do_not_use_in_prod" npx jest --config ./test/jest-e2e.json
  ```
  8/9 pass at baseline; test "A" fails because it asserts a mixed-case email while the API lowercases emails — pre-existing test bug, not an environment issue.
