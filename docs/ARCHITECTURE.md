# ARCHITECTURE — ServiceManager.AI

Этот документ описывает текущую архитектуру платформы.

ServiceManager.AI — это SaaS-платформа управления сервисными заявками
для сервисных компаний и сетей.

Технологический стек:

- Backend: NestJS
- ORM: Prisma
- Database: PostgreSQL
- Auth: JWT
- Architecture: Modular + PBAC
- Deployment: Docker + local WSL runtime

---

# 1. Архитектурные принципы

## 1.1 Multi-tenant архитектура

Каждая доменная сущность содержит:

companyId

Это обеспечивает:

- изоляцию данных между компаниями
- возможность SaaS-масштабирования
- поддержку enterprise-клиентов

Любой запрос обязан фильтроваться по companyId.

Источник companyId:

JWT payload > req.user.companyId

Запрещено:

- доступ к данным другой компании
- глобальные выборки без companyId

---

## 1.2 API-first

Backend является API-платформой.

Frontend, mobile app и интеграции работают через API.

Все изменения должны учитывать:

- обратную совместимость API
- стабильность контрактов
- масштабируемость

---

## 1.3 Модульная архитектура (NestJS)

Система разделена на модули:

AuthModule
UsersModule
CompanyModule
TicketsModule
SpecializationsModule
ProblemCategoriesModule
TechniciansModule
PermissionsModule
EventsModule

Каждый модуль содержит:

controller
service
dto
module

Бизнес-логика размещается **только в service**.

Контроллеры не содержат бизнес-логики.

---

# 2. Runtime environments

Платформа поддерживает два корректных режима запуска backend.

## 2.1 Local WSL runtime

Использует файл:

`backend/.env`

Database host:

`localhost:5432`

Этот режим нужен для запуска backend напрямую из WSL, когда Postgres поднят через Docker и опубликован на host.

## 2.2 Docker runtime

Использует файл:

`backend/.env.docker`

Database host:

`postgres:5432`

Этот host валиден только внутри `docker compose` сети.

## 2.3 Инвариант окружений

Запрещено:

- вручную переписывать `DATABASE_URL` в одном и том же `.env`
- использовать `postgres` host для локального WSL backend
- использовать `localhost` host внутри docker backend

---

# 3. Слои архитектуры

Платформа использует слоистую модель:

Controller
v
Guard / PermissionGuard
v
Policy Layer (RoleScopePolicy)
v
Service Layer
v
Domain Events
v
Prisma / Database
