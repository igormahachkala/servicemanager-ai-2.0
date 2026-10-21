# Backend Runbook

## Runtime environments

### Local WSL runtime

Uses `backend/.env`.

Expected database URL host:

`localhost:5432`

Expected backend port:

`3001`

Start commands:

```bash
cd /home/igor/projects/sma-service/backend
npm install
npm run prisma:generate:local
npm run start:dev
```

Local backend URL:

`http://localhost:3001`

Docker backend does not need to be stopped for this flow.

### Docker runtime

Stage and Production use external environment files defined by the deployment
compose overrides. Do not create `backend/.env.docker` in deployment
worktrees.

Expected database URL host:

`postgres:5432`

Expected backend port:

`3000`

Start commands:

```bash
cd /home/igor/projects/sma-service
SMA_RELEASE_COMMIT_SHA=$(git rev-parse HEAD) \
SMA_RELEASE_ENVIRONMENT=beta \
SMA_RELEASE_ENFORCE=true \
docker compose up -d --build postgres backend
```

Docker backend URL:

`http://localhost:3000`

## Node version

Normal WSL dev shells must use Node 20 by default.

Check:

```bash
node -v
npm -v
```

If the current shell is stale, reload it:

```bash
source ~/.profile
```

## Env files

- `backend/.env` - local WSL backend
- `backend/.env.example` - example local WSL env
- Stage/Production runtime env files - external to repository worktrees

Do not manually switch `DATABASE_URL` inside one file.
