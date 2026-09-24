# AI CONTEXT — ServiceManager.AI

Этот документ используется для инициализации нового AI-чата.

Его задача — быстро передать архитектурный контекст проекта,
чтобы AI не ломал архитектуру и понимал правила разработки.


---

# 1. Проект

ServiceManager.AI — это SaaS-платформа
для управления сервисными заявками и сервисной сетью.

Целевая аудитория:

- сервисные компании
- франчайзинговые сети
- сети точек
- управляющие компании

Аналоги:

Hubex  
Okdesk  
Planado


---

# 2. Технологический стек

Backend:

NestJS

ORM:

Prisma

Database:

PostgreSQL

Auth:

JWT

Deployment:

Docker


---

# 3. Multi-tenant модель

Система является multi-tenant SaaS.

Каждая доменная сущность содержит:

companyId

Любой запрос обязан фильтроваться по:

req.user.companyId

Это критический инвариант системы.

Нельзя:

- выполнять запросы без companyId
- возвращать данные другой компании


---

# 4. Архитектура

Система построена по слоистой архитектуре.

Controller  
↓  
Guard  
↓  
Policy Layer  
↓  
Service  
↓  
Domain Events  
↓  
Prisma / Database


---

# 5. Правило Service Layer

Бизнес-логика размещается только в:

Service

Controller отвечает только за:

- HTTP
- DTO
- вызов service

Controller не содержит бизнес-логики.


---

# 6. Модель доступа

Система использует:

PBAC (Permission Based Access Control)

Модель:

Role  
+  
PermissionBlocks


Примеры permission:

TICKETS_VIEW  
TICKETS_ASSIGN  
TICKETS_CLAIM  
TICKETS_STATUS_CHANGE  
USERS_MANAGE  
ANALYTICS_VIEW


Permission проверяется через:

PermissionGuard


---

# 7. Data Scope

Permissions отвечают:

можно ли действие

Policy отвечает:

к каким данным применимо действие


Scope уровни:

ALL  
COMPANY  
ASSIGNED_TO_ME  
CREATED_BY_ME


Policy реализуется через:

RoleScopePolicy


---

# 8. Основные сущности

Company  
User  
Ticket  
Specialization  
ProblemCategory  
DomainEvent


---

# 9. Ticket System

Ticket — центральная сущность системы.

Поля:

id  
companyId  
problemCategoryId  
problemText  
urgency  
status  
assignedTechnicianId  
slaMinutes


---

# 10. Ticket Assignment

Алгоритм:

1. Определить специализации категории проблемы
2. Найти техников с этими специализациями
3. Если autoAssignEnabled:

назначить первого кандидата

4. Иначе:

оставить статус NEW


---

# 11. Claim механизм

Техник может забирать NEW заявки.

API:

GET /tickets/available  
POST /tickets/:id/claim


После claim:

assignedTechnicianId обновляется.


---

# 12. Ticket Board

Основной интерфейс системы.

Колонки:

NEW  
ASSIGNED  
IN_PROGRESS  
DONE  
CANCELED


API:

GET /tickets/board


---

# 13. Domain Events

Любые важные действия фиксируются.

Таблица:

DomainEvent

Примеры:

ticket.created  
ticket.assigned  
ticket.claimed  
ticket.status_changed


Это используется для:

- аудита
- аналитики
- SLA
- workflow engine


---

# 14. Основные документы архитектуры

Перед изменением системы AI обязан учитывать:

docs/PLATFORM_CONSTITUTION_V2.md  
docs/02_ARCHITECTURE.md
docs/03_ACCESS_MODEL.md
docs/08_PERMISSIONS_MATRIX.md
docs/LEGACY/CONTRIBUTING_AI_RULES.md


---

# 15. Правило работы с файлами

В проекте используется строгий режим.

Если AI меняет файл:

1. Пользователь выводит файл полностью
2. AI возвращает полный файл
3. Файл заменяется полностью

Запрещено:

- partial patches
- вставка фрагментов
- редактирование кусками


---

# 16. Безопасность

Нельзя:

- хардкодить токены
- хардкодить JWT
- хранить секреты в коде
- коммитить .env


---

# 17. Архитектурная цель

ServiceManager.AI должен стать
enterprise-уровня платформой
управления сервисной сетью.

Ключевые элементы архитектуры:

PBAC  
Policy Layer  
Domain Events  
SLA Engine  
Analytics Engine
