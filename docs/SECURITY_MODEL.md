# SECURITY MODEL — ServiceManager.AI

Этот документ описывает модель безопасности платформы.

ServiceManager.AI — мульти-тенант SaaS система,
поэтому безопасность строится вокруг строгой изоляции компаний.

Основные принципы:

- multi-tenant isolation
- JWT authentication
- PBAC access control
- policy-based data visibility
- audit via domain events


---

# 1. Multi-tenant Isolation

Каждая доменная сущность обязана содержать:

companyId

Примеры:

User  
Ticket  
Specialization  
ProblemCategory  
DomainEvent  

Любой запрос к базе обязан включать:

companyId = req.user.companyId

Источник companyId:

JWT payload.

Пример:

req.user.companyId

Запрещено:

- выполнять запросы без companyId
- возвращать данные других компаний
- делать глобальные выборки

Это критический инвариант SaaS.


---

# 2. JWT Authentication

Аутентификация строится на JWT.

Token создаётся через:

POST /auth/login

или

POST /auth/register


---

## 2.1 JWT Payload

JWT содержит:

{
  sub: userId,
  email: string,
  companyId: string,
  role: string
}

Используется для:

- идентификации пользователя
- multi-tenant фильтрации
- базовых role checks


---

## 2.2 JWT Secret

JWT подписывается:

JWT_SECRET

Хранится только в:

.env  
docker-compose env  
production secret manager

Запрещено:

- хардкодить JWT_SECRET
- хранить секреты в коде
- коммитить .env


---

## 2.3 Token lifetime

Текущая модель:

short-lived access token.

Будущее развитие:

refresh tokens  
session management


---

# 3. Guards

Guards отвечают за проверку доступа к действиям.

Примеры:

JwtAuthGuard  
RolesGuard  
PermissionGuard


---

## 3.1 JwtAuthGuard

Проверяет:

- наличие токена
- подпись JWT
- срок действия

Добавляет в request:

req.user


---

## 3.2 RolesGuard

Проверяет:

role пользователя.

Используется для:

- legacy RBAC
- совместимости


---

## 3.3 PermissionGuard

Основной механизм доступа.

Проверяет наличие:

PermissionBlock

например:

TICKETS_VIEW  
TICKETS_VIEW_AVAILABLE  
TICKETS_ASSIGN  
TICKETS_CLAIM  
TICKETS_STATUS_CHANGE  


---

# 4. Permission-Based Access Control (PBAC)

Модель:

Role  
+  
PermissionBlocks


---

## 4.1 PermissionBlock

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

## 4.2 RolePermission

Связь:

role → permissionBlock

Это позволяет:

- менять права ролей без изменения кода
- добавлять новые функции
- продавать feature пакеты


---

## 4.3 UserPermission (future)

Позволяет:

назначать permission напрямую пользователю.

Используется для:

enterprise кастомизаций.


---

# 5. Policy Layer (Data Scope)

Permissions отвечают на вопрос:

можно ли действие

Policy отвечает на вопрос:

к каким данным применимо действие


---

## 5.1 Scope уровни

ALL  
COMPANY  
ASSIGNED_TO_ME  
CREATED_BY_ME  


---

## 5.2 Пример

TECHNICIAN:

может:

TICKETS_VIEW

но scope:

ASSIGNED_TO_ME


---

# 6. Ticket Access Rules

ADMIN

может:

- видеть все тикеты компании
- назначать техников
- менять статусы
- управлять настройками


MASTER / DISPATCHER

может:

- создавать тикеты
- назначать техников
- управлять заявками


TECHNICIAN

может:

- видеть назначенные тикеты
- видеть доступные NEW заявки
- делать claim
- менять статус


CLIENT

может:

- создавать заявки
- видеть свои заявки


---

# 7. Domain Event Audit

Любые критические действия фиксируются.

Таблица:

DomainEvent

Примеры:

ticket.created  
ticket.assigned  
ticket.claimed  
ticket.status_changed  

Это обеспечивает:

- audit trail
- расследование инцидентов
- аналитику


---

# 8. Secrets Management

Секреты могут храниться только в:

.env  
docker-compose  
secret manager (production)

Запрещено:

- хардкодить секреты
- хранить секреты в Git
- публиковать токены


---

# 9. API Security

Все защищённые endpoints требуют:

Authorization: Bearer <JWT>

Пример:

curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer TOKEN"


---

# 10. Будущие улучшения безопасности

Планируемые улучшения:

refresh tokens  
rate limiting  
API throttling  
IP restrictions  
company API keys  
security audit log  


---

# 11. Критические инварианты безопасности

Нельзя:

- обходить guards
- отключать companyId фильтрацию
- использовать raw SQL без фильтра
- возвращать cross-company данные

Любое нарушение этих правил
ломает multi-tenant безопасность системы.


---

# 12. Security Philosophy

Безопасность платформы строится вокруг:

strict tenant isolation  
least privilege access  
auditable actions  

Это позволяет системе работать
как enterprise SaaS.
