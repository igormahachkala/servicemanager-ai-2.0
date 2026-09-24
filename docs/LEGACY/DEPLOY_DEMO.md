# Deploy Demo

## Что нужно
- Docker и Docker Compose
- заполненный `backend/.env.docker`

## Переменные окружения
Backend в Docker использует `backend/.env.docker`.
Главное правило: внутри Docker backend должен ходить в Postgres по имени сервиса.

Пример:

```env
DATABASE_URL="postgresql://sma_user:sma_password@postgres:5432/sma_db?schema=public"
JWT_SECRET="change_me"
PORT=3000
```

## Запуск
Из корня проекта:

```bash
docker compose up -d --build postgres backend web
```

## Что поднимется
- Postgres: `localhost:5432`
- Backend: `http://localhost:3000`
- Web: `http://localhost:4173`

## Миграции
Backend container применяет миграции на старте:

```bash
npx prisma migrate deploy && npm run start:docker
```

## Проверка backend

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

## Проверка frontend
Открыть в браузере:

```text
http://localhost:4173
```

## Важное замечание по этой машине
В текущей Windows/UNC/WSL host-среде сборка Docker image из `\\wsl.localhost\...` может падать на host-ошибке Docker (`Incorrect function`).
Это не проблема application code. Для первого серверного деплоя лучше запускать `docker compose`:
- либо внутри обычной Linux/WSL shell
- либо на целевом Linux server
- либо из локальной директории без UNC host seam
