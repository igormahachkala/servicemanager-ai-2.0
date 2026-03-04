# PLATFORM CONSTITUTION V2 — ServiceManager.AI

Статус: Active  
Тип: Архитектурная конституция платформы

Этот документ фиксирует фундаментальные правила архитектуры
ServiceManager.AI.

Нарушение этих правил приводит к архитектурной деградации системы.

Документ обязателен для:

- разработчиков
- AI-ассистентов
- архитекторов системы


---

# 1. Цель платформы

ServiceManager.AI — это SaaS-платформа управления сервисной сетью.

Платформа должна масштабироваться до:

- крупных сервисных компаний
- сетевых структур
- франчайзинговых сетей
- enterprise-клиентов

Система должна быть:

- multi-tenant
- безопасной
- масштабируемой
- расширяемой


---

# 2. Главные архитектурные инварианты

Инварианты — это правила, которые **никогда нельзя нарушать**.

## 2.1 Multi-tenant инвариант

Каждая доменная сущность обязана содержать:

companyId

Все запросы к базе должны фильтроваться по:

req.user.companyId

Запрещено:

- глобальные выборки
- cross-tenant доступ
- отсутствие фильтра companyId


---

## 2.2 Backend — источник истины

Backend является единственным источником бизнес-логики.

Запрещено:

- переносить бизнес-логику во frontend
- дублировать бизнес-логику


---

## 2.3 Service-layer правило

Бизнес-логика размещается только в:

Service

Controller отвечает только за:

- HTTP
- DTO
- передачу данных


---

# 3. Capability vs Data Scope

Архитектура доступа разделена на два уровня.

Capability  
↓  
Data Scope


---

## 3.1 Capability (Permission)

Capability отвечает на вопрос:

МОЖНО ЛИ ВЫПОЛНИТЬ ДЕЙСТВИЕ


Пример:

TICKETS_ASSIGN  
TICKETS_VIEW  
TICKETS_CLAIM  
TICKETS_STATUS_CHANGE


Capability проверяется через:

PermissionGuard


---

## 3.2 Data Scope (Policy)

Scope отвечает на вопрос:

К КАКИМ ДАННЫМ ПРИМЕНИМО ДЕЙСТВИЕ

Примеры scope:

ALL  
COMPANY  
ASSIGNED_TO_ME  
CREATED_BY_ME


Scope реализуется через:

RoleScopePolicy


---

# 4. Архитектурные слои

Система использует слоистую архитектуру.

Controller  
↓  
Guard (PermissionGuard)  
↓  
Policy Layer  
↓  
Service  
↓  
Domain Events  
↓  
Database (Prisma)


---

## 4.1 Controller

Отвечает за:

- HTTP маршруты
- DTO
- вызов service

Controller не содержит бизнес-логики.


---

## 4.2 Guard

Guard проверяет:

можно ли выполнить действие.


---

## 4.3 Policy

Policy определяет:

какие данные доступны.


---

## 4.4 Service

Service выполняет:

- бизнес-операции
- работу с базой
- создание Domain Events


---

# 5. Permission-Based Access Control (PBAC)

Система использует PBAC модель.

Модель:

Role  
+  
Permission Blocks


---

## 5.1 PermissionBlock

Таблица:

PermissionBlock

Поля:

id  
code  
name  
description


Примеры permission:

TICKETS_CREATE  
TICKETS_ASSIGN  
TICKETS_VIEW  
TICKETS_CLAIM  
TICKETS_STATUS_CHANGE  
USERS_MANAGE  
ANALYTICS_VIEW  


---

## 5.2 RolePermission

Связь:

role → permissionBlock

Это позволяет:

- гибко управлять правами
- расширять систему
- создавать feature-packages


---

# 6. Domain Event Architecture

Любое важное действие фиксируется
в Event Store.

Таблица:

DomainEvent


Примеры событий:

ticket.created  
ticket.assigned  
ticket.claimed  
ticket.status_changed


Event Store используется для:

- аудита
- аналитики
- SLA
- workflow engine


---

# 7. Ticket System

Ticket — центральная сущность платформы.

Ticket содержит:

id  
companyId  
problemCategoryId  
problemText  
urgency  
status  
assignedTechnicianId  
slaMinutes


---

# 8. Ticket Assignment

Алгоритм назначения:

1. Определить специализации категории проблемы
2. Найти техников с этими специализациями
3. Если autoAssignEnabled:

назначить первого кандидата

4. Иначе:

оставить NEW


---

# 9. Claim механизм

Техник может забирать заявки.

API:

GET /tickets/available  
POST /tickets/:id/claim


После claim:

assignedTechnicianId обновляется.


---

# 10. Ticket Board

Основной интерфейс системы.

Колонки:

NEW  
ASSIGNED  
IN_PROGRESS  
DONE  
CANCELED


API:

GET /tickets/board


Board поддерживает фильтры:

status  
assigneeId  
sla  
search


---

# 11. SLA foundation

Каждый тикет содержит:

slaMinutes


Будущий SLA engine будет вычислять:

deadline  
atRisk  
breached


---

# 12. Запрещённые архитектурные практики

Нельзя:

- писать бизнес-логику в controller
- обходить guards
- писать raw SQL без причины
- делать запросы без companyId
- хардкодить токены


---

# 13. Долгосрочная архитектура

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

# 14. Главная цель архитектуры

ServiceManager.AI должен стать
enterprise-уровня платформой
управления сервисной сетью.

Ключевые элементы:

- PBAC
- Policy Layer
- Event Store
- SLA Engine
- Analytics
