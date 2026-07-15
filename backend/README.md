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

Uses `backend/.env.docker`.

Expected database URL host:

`postgres:5432`

Expected backend port:

`3000`

Start commands:

```bash
cd /home/igor/projects/sma-service
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
- `backend/.env.docker` - docker compose backend
- `backend/.env.example` - example local WSL env

Do not manually switch `DATABASE_URL` inside one file.
