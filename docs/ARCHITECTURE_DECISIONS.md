# ARCHITECTURE DECISIONS — ServiceManager.AI

Этот документ фиксирует архитектурные решения проекта.

Каждое решение оформляется как ADR
(Architecture Decision Record).

ADR отвечает на вопрос:

ПОЧЕМУ архитектура сделана именно так.

Это предотвращает:

- хаотичные изменения
- повторные споры
- архитектурную деградацию


---

# ADR-001 — Multi-tenant architecture

Статус: Accepted

## Контекст

ServiceManager.AI является SaaS системой.

Система должна обслуживать множество компаний
в одной базе данных.

## Решение

Каждая доменная сущность содержит:

companyId

Все запросы фильтруются по:

req.user.companyId

## Последствия

Плюсы:

- изоляция данных
- масштабируемость
- SaaS модель

Минусы:

- необходимо строго соблюдать фильтрацию


---

# ADR-002 — Backend API-first architecture

Статус: Accepted

## Контекст

Платформа должна поддерживать:

- web frontend
- mobile приложение
- интеграции

## Решение

Backend является API-first системой.

Все клиенты работают через API.

## Последствия

Плюсы:

- гибкость архитектуры
- поддержка мобильных клиентов

Минусы:

- необходимость стабильных API контрактов


---

# ADR-003 — Service Layer principle

Статус: Accepted

## Контекст

Бизнес-логика не должна смешиваться
с HTTP обработкой.

## Решение

Controller отвечает только за:

- HTTP
- DTO
- вызов service

Service содержит:

- бизнес-логику
- работу с Prisma

## Последствия

Плюсы:

- чистая архитектура
- тестируемость


---

# ADR-004 — Permission Based Access Control

Статус: Accepted

## Контекст

Role-based модель плохо масштабируется.

Большие системы требуют гибкой модели прав.

## Решение

Использовать PBAC.

Модель:

Role  
+  
Permission Blocks

Permission проверяется через:

PermissionGuard

## Последствия

Плюсы:

- гибкость прав
- возможность feature packages

Минусы:

- более сложная архитектура


---

# ADR-005 — Capability vs Data Scope

Статус: Accepted

## Контекст

Обычные permission системы не разделяют:

действие  
и  
доступ к данным

## Решение

Разделить:

Capability  
Data Scope

Capability:

можно ли действие

Scope:

к каким данным применимо действие

Scope реализуется через:

RoleScopePolicy


---

# ADR-006 — Domain Event Store

Статус: Accepted

## Контекст

Необходимо:

- аудит действий
- аналитика
- SLA engine

## Решение

Ввести таблицу:

DomainEvent

Любые важные операции
записываются в Event Store.

## Последствия

Плюсы:

- audit trail
- аналитика
- основа event-driven архитектуры


---

# ADR-007 — Ticket Board architecture

Статус: Accepted

## Контекст

Основной интерфейс системы —
kanban board.

## Решение

Создать endpoint:

GET /tickets/board

Board возвращает:

columns  
cards  
meta

## Последствия

Плюсы:

- быстрый интерфейс
- удобная работа с заявками


---

# ADR-008 — Auto assignment

Статус: Accepted

## Контекст

Система должна автоматически
распределять заявки.

## Решение

Алгоритм:

1. определить специализации категории
2. найти техников с этими специализациями
3. если autoAssignEnabled:

назначить первого кандидата

4. иначе:

оставить NEW


---

# ADR-009 — Claim mechanism

Статус: Accepted

## Контекст

Некоторые сервисные компании
используют pull модель.

## Решение

Техники могут забирать заявки.

API:

GET /tickets/available  
POST /tickets/:id/claim


---

# ADR-010 — Docker development environment

Статус: Accepted

## Контекст

Необходимо одинаковое окружение разработки.

## Решение

Использовать Docker.

Контейнеры:

backend  
postgres  


---

# ADR-011 — Prisma ORM

Статус: Accepted

## Контекст

Необходима удобная работа с PostgreSQL.

## Решение

Использовать Prisma ORM.

Причины:

- типизация
- миграции
- удобный API


---

# ADR-012 — Architecture documentation

Статус: Accepted

## Контекст

Сложные системы требуют документации.

## Решение

Поддерживать архитектурные документы:

PLATFORM_CONSTITUTION  
ARCHITECTURE  
SECURITY_MODEL  
TICKET_VISIBILITY_MATRIX  
AI_CONTEXT


---

# Добавление новых ADR

Каждое новое решение добавляется как:

ADR-XXX

Структура записи:

Контекст  
Решение  
Последствия
