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
- Deployment: Docker

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

JWT payload → req.user.companyId

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

# 2. Слои архитектуры

Платформа использует слоистую модель:

Controller  
↓  
Guard / PermissionGuard  
↓  
Policy Layer (RoleScopePolicy)  
↓  
Service Layer  
↓  
Domain Events  
↓  
Prisma / Database

---

## 2.1 Controller

Controller отвечает только за:

- HTTP маршруты
- валидацию DTO
- передачу данных в service

Controller не должен:

- выполнять бизнес-логику
- работать с Prisma напрямую

---

## 2.2 Guards

Guards проверяют **можно ли выполнять действие**.

Примеры:

RolesGuard  
PermissionGuard

Guard проверяет:

- JWT
- роль пользователя
- permission block

Guard **не фильтрует данные**.

---

## 2.3 Policy Layer

Policy отвечает за:

**какие данные пользователь может видеть**.

Пример:

RoleScopePolicy

Scope:

ALL  
COMPANY  
ASSIGNED_TO_ME  
CREATED_BY_ME

Policy применяется на уровне service.

---

## 2.4 Service Layer

Service содержит:

- бизнес-логику
- правила системы
- работу с Prisma
- вызов Domain Events

Service — главный слой бизнес-логики.

---

## 2.5 Domain Events

Любые важные изменения записываются в Event Store.

Таблица:

DomainEvent

Пример событий:

ticket.created  
ticket.assigned  
ticket.claimed  
ticket.status_changed

Это используется для:

- аудита
- аналитики
- SLA
- будущего event-driven архитектурного перехода

---

# 3. Модель доступа

Система использует **PBAC (Permission-Based Access Control)**.

Модель:

Role  
+  
PermissionBlocks

---

## 3.1 PermissionBlock

Таблица:

PermissionBlock

Поля:

id  
code  
name  
description

Примеры:

TICKETS_VIEW  
TICKETS_VIEW_AVAILABLE  
TICKETS_ASSIGN  
TICKETS_CLAIM  
TICKETS_STATUS_CHANGE  
USERS_MANAGE  
COMPANY_SETTINGS_EDIT  
ANALYTICS_VIEW

---

## 3.2 RolePermission

Связь:

role → permissionBlock

Позволяет:

- гибко настраивать роли
- добавлять новые функции без изменения кода
- делать feature-packages

---

## 3.3 UserPermission (будущее)

Позволяет:

давать индивидуальные permission пользователям
поверх роли.

Это нужно для enterprise-клиентов.

---

# 4. Основные сущности системы

## Company

Компания внутри SaaS.

Поля:

id  
name  
autoAssignEnabled

---

## User

Пользователь системы.

Поля:

id  
companyId  
email  
password  
role

---

## Specialization

Специализация техника.

Примеры:

электрика  
IT  
холодильники

---

## ProblemCategory

Категория проблемы.

Связана со специализациями.

Используется для:

- автоназначения
- аналитики
- инструкций

---

## Ticket

Основная сущность системы.

Поля:

id  
companyId  
parentId  
requesterName  
requesterPhone  
address  
pointName  
problemCategoryId  
problemText  
urgency  
status  
slaMinutes  
assignedTechnicianId

---

# 5. Назначение тикетов

Алгоритм назначения:

1) определить специализации категории проблемы

2) найти техников с этими специализациями

3) если autoAssignEnabled = true

→ назначить первого кандидата

4) иначе

→ тикет остаётся NEW

и возвращается список кандидатов.

---

# 6. Claim механизм

Техник может забирать NEW заявки.

API:

GET /tickets/available  
POST /tickets/:id/claim

Техник видит:

NEW заявки своей специализации.

После claim:

assignedTechnicianId = technicianId

---

# 7. Ticket Board

Board — основной интерфейс работы.

Колонки:

NEW  
ASSIGNED  
IN_PROGRESS  
DONE  
CANCELED

API:

GET /tickets/board

Board возвращает:

columns  
cards  
meta

Фильтры:

status  
assigneeId  
sla  
search

---

# 8. SLA foundation

Каждый тикет содержит:

slaMinutes

Будущий SLA-движок будет считать:

deadline  
atRisk  
breached

Board API уже учитывает SLA-фильтры.

---

# 9. Domain Event Store

Все критические действия записываются в:

DomainEvent

Поля:

id  
companyId  
entityType  
entityId  
type  
payload  
createdAt

Это база для:

audit log  
analytics  
SLA engine  
workflow engine

---

# 10. Долгосрочная архитектура

Платформа развивается к:

Service Network Platform.

Будущие модули:

SLA Engine  
Zones / Territories  
Workflow Engine  
Analytics Engine  
Billing  
Files / Media  
Comments  
Mobile API

---

# 11. Архитектурные ограничения

Запрещено:

- писать бизнес-логику в controller
- делать запросы без companyId
- использовать raw SQL без причины
- обходить permission checks
- хардкодить токены

---

# 12. Архитектурная цель

ServiceManager.AI должен стать:

enterprise-уровня платформой
управления сервисной сетью.

Ключевые элементы:

- PBAC
- Policy Layer
- Event Store
- SLA Engine
- Analytics

Это переход от MVP
к платформенной архитектуре.
