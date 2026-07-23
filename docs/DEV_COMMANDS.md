# DEV COMMANDS - Сервис Менеджер

Purpose:

Standardize the API development and verification commands.

Base URLs (dev):

- Docker backend: `http://localhost:3000`
- Local WSL backend: `http://localhost:3001`

---

# 0. Naming standard

- Product/platform: `Сервис Менеджер`
- Developer brand: `СМА-Тех`
- Temporary right holder in legal documents: `ИП Ермаков И. А.`

Do not use `СМА-Тех` as the product name and do not use `Сервис Менеджер` as the company name.

---

# 1. Runtime modes

## Local WSL backend

- env source: `backend/.env`
- database host: `localhost:5432`
- backend port: `3001`
- docker backend can stay running on `3000`
- command: `cd /home/igor/projects/sma-service/backend && npm run start:dev`

## Docker backend

- env source: `backend/.env.docker`
- database host: `postgres:5432`
- backend port: `3000`
- command: `cd /home/igor/projects/sma-service && docker compose up -d --build postgres backend`

Do not switch `DATABASE_URL` manually inside the same `.env` file.

---

# 2. Node 20 in WSL

A normal WSL dev shell must use Node 20 by default.

Check:

```bash
node -v
npm -v
```

If the shell was opened before the init-file update, open a new WSL session or run:

```bash
source ~/.profile
node -v
npm -v
```

---

# 3. Local WSL setup

Start Postgres through compose:

```bash
cd /home/igor/projects/sma-service
docker compose up -d postgres
```

Start the backend locally from WSL:

```bash
cd /home/igor/projects/sma-service/backend
npm install
npm run prisma:generate:local
npm run start:dev
```

Expected local backend URL:

```text
http://localhost:3001
```

Docker backend does not need to be stopped, because it stays on `3000`.

---

# 4. Docker setup

Start Postgres and backend in compose:

```bash
cd /home/igor/projects/sma-service
docker compose up -d --build postgres backend
```

Expected docker backend URL:

```text
http://localhost:3000
```

Show backend logs:

```bash
docker logs -n 100 sma_backend
```

Stop the stack:

```bash
docker compose down
```

---

# 5. Prisma

Local generate:

```bash
cd /home/igor/projects/sma-service/backend
npm run prisma:generate:local
```

Docker-oriented generate:

```bash
cd /home/igor/projects/sma-service/backend
npm run prisma:generate:docker
```

Local migration:

```bash
cd /home/igor/projects/sma-service/backend
npm run prisma:migrate:dev -- --name migration_name
```

Studio:

```bash
cd /home/igor/projects/sma-service/backend
npm run prisma:studio
```

---

# 6. Onboarding model

Self-service registration is disabled.

Company provisioning path:
- PLATFORM_ADMIN logs in
- PLATFORM_ADMIN creates company in /companies
- PLATFORM_ADMIN creates the first company admin
- tenant users log in with issued credentials

Public users must not use /auth/register for company creation.
Use the public /request-access route for support and public intake instead.
