# PLATFORM CONSTITUTION v2
ServiceManager.AI

Статус: Active Architecture Contract  
Версия: 2.1  
Тип документа: Архитектурная конституция платформы  

---

# 1. Главный принцип платформы

ServiceManager.AI — multi-tenant SaaS уровня enterprise.

Система строится по фундаментальному разделению:

КТО МОЖЕТ → Capability (Permission Blocks / PBAC)  
ЧТО ВИДИТ И К ЧЕМУ ИМЕЕТ ДОСТУП → Data Scope (RoleScopePolicy)

Эти уровни запрещено смешивать.

---

# 2. Слои архитектуры

Архитектура строго слоистая:

1. Auth Layer (JWT)
2. Capability Layer (PBAC)
3. Data Policy Layer (RoleScopePolicy)
4. Service Layer (Business Logic)
5. DB Layer (Prisma / PostgreSQL)

---

# 3. Capability Layer (PBAC)

## 3.1 Назначение

Permission Blocks отвечают только на вопрос:

> Разрешено ли выполнять действие вообще?

Guard НЕ:

- строит where
- фильтрует данные
- проверяет специализации
- проверяет assigned
- содержит бизнес-логику

Guard делает только:

ALLOW / DENY действия.

---

## 3.2 Правила Permission Codes

Формат:

DOMAIN_ACTION[_QUALIFIER]

Примеры:

TICKETS_READ  
TICKETS_CREATE  
TICKETS_ASSIGN  
TICKETS_CLAIM  
TICKETS_STATUS_CHANGE  
TICKETS_EDIT  
ANALYTICS_VIEW  
SLA_MANAGE  
USERS_MANAGE  

Запрещено:

- Дублировать смысл
- Создавать “почти одинаковые” коды
- Вводить permission без документации

Все коды фиксируются централизованно.

---

## 3.3 Приоритет прав

Allow = объединение:

RolePermission + UserPermission

Если permission отсутствует → DENY.

MVP не использует explicit DENY модель.

---

# 4. Data Policy Layer (RoleScopePolicy)

## 4.1 Назначение

RoleScopePolicy отвечает на вопрос:

> К каким данным можно применять разрешённое действие?

Policy:

- строит Prisma where
- проверяет object-access
- определяет scope list/get
- определяет ограничения assign/claim/status/edit

Policy — единственная точка правды для data-access.

---

## 4.2 Инварианты

- Любой where обязан содержать companyId
- Service не пишет собственные where-фильтры
- Guard не содержит scope-логики
- Policy не пишет в БД
- Любой write требует и Permission, и Policy-проверки

---

# 5. Поддерживаемые роли (UserRole enum)

На текущем этапе система поддерживает:

ADMIN  
MASTER  
DISPATCHER (совместимость)  
TECHNICIAN  
CLIENT  
TERRITORIAL_MANAGER  
NETWORK_DIRECTOR  
STAFF  

Любая новая роль должна быть отражена:

- В Ticket Visibility Matrix
- В Permission mapping
- В e2e тестах

---

# 6. Ticket Visibility Contract v2

Официальный контракт поведения зафиксирован в:

docs/TICKET_VISIBILITY_MATRIX.md

Ключевые правила:

ADMIN:
- READ: ALL
- WRITE: ALL

MASTER / DISPATCHER:
- READ: ALL
- ASSIGN: YES
- STATUS_CHANGE: YES

NETWORK_DIRECTOR:
- READ: ALL
- WRITE: YES

TERRITORIAL_MANAGER:
- READ: ALL (в MVP)
- WRITE: YES (в MVP)
- Позже станет ZONE-scoped

STAFF:
- READ: ALL
- WRITE: только через Permission Blocks

TECHNICIAN:
- READ: ALL within company
- CLAIM: NEW + matching specialization
- STATUS_CHANGE: only assigned to self
- ASSIGN: NO

CLIENT:
- READ: CREATED_BY_ME
- CREATE: YES
- WRITE: ограниченно по правилам

Изменение этого контракта требует:

1. Обновления матрицы
2. Обновления e2e тестов
3. Обновления данного документа (если меняется принцип)

---

# 7. Multi-Tenant Инвариант

Любая операция обязана фильтроваться по:

companyId

Нарушение этого правила считается критической ошибкой безопасности.

---

# 8. SLA Foundation

SLA — платформенный механизм.

## 8.1 Поля Ticket

slaDueAt  
slaBreachedAt  

## 8.2 Worker

Фоновая задача:

slaDueAt < now  
AND slaBreachedAt is null  
AND status not in (DONE, CANCELED)

Отмечает breach.

SLA расчёты не должны зависеть от контроллеров.

---

# 9. Analytics Readiness

Источник правды:

TicketStatusHistory

Метрики v1:

- Tickets count
- Mean time to assign
- Mean time to resolve
- SLA breached count
- Throughput per technician

Analytics строится на событиях, а не на текущем статусе.

---

# 10. Запрещено

- Хардкодить JWT
- Хардкодить токены
- Смешивать Guard и Policy
- Писать where вне Policy
- Убирать companyId фильтрацию
- Давать TECHNICIAN изменение чужих тикетов

---

# 11. Стратегическая цель

Перейти от:

Role-based access

К:

Role + Permission Blocks + Centralized Scope Policy

Это позволит:

- Не плодить роли
- Делать enterprise кастомизацию
- Продавать функциональные пакеты
- Масштабироваться до Hubex-уровня

---

# 12. Итог

ServiceManager.AI — не CRM для мастеров.

Это платформа управления сервисной сетью.

Любое архитектурное решение должно быть совместимо
с будущим масштабированием.
