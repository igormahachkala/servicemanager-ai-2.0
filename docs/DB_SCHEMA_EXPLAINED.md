# DB SCHEMA EXPLAINED — ServiceManager.AI

Этот документ объясняет структуру базы данных системы.

Он дополняет файл:

prisma/schema.prisma

Цель документа:

- объяснить назначение таблиц
- описать связи
- предотвратить ошибки при миграциях


---

# 1. Общая модель данных

ServiceManager.AI — multi-tenant SaaS система.

Все доменные сущности содержат:

companyId

Это обеспечивает:

- изоляцию данных
- масштабируемость


---

# 2. Основные таблицы

Основные таблицы системы:

Company  
User  
Ticket  
Specialization  
ProblemCategory  
TechnicianSpecialization  
ProblemCategorySpecialization  
PermissionBlock  
RolePermission  
DomainEvent


---

# 3. Company

Компания внутри SaaS.

Таблица:

Company

Основные поля:

id  
name  
autoAssignEnabled  


Назначение:

- изоляция данных
- настройки компании


Связи:

Company → Users  
Company → Tickets  
Company → Specializations  
Company → ProblemCategories  


---

# 4. User

Пользователь системы.

Таблица:

User

Основные поля:

id  
companyId  
email  
password  
role  


Роли:

ADMIN  
MASTER  
TECHNICIAN  
CLIENT  
NETWORK_DIRECTOR  
STAFF  


Связи:

User → Company  
User → Tickets (assignedTechnicianId)


---

# 5. Ticket

Основная сущность системы.

Таблица:

Ticket

Основные поля:

id  
companyId  
parentId  
problemCategoryId  
problemText  
urgency  
status  
assignedTechnicianId  
slaMinutes  


Назначение:

управление сервисными заявками.


Связи:

Ticket → Company  
Ticket → ProblemCategory  
Ticket → User (technician)  
Ticket → Ticket (parent-child)


---

# 6. Specialization

Специализация техника.

Таблица:

Specialization

Примеры:

электрика  
IT  
кофемашины  
холодильное оборудование


Связи:

Specialization → TechnicianSpecialization  
Specialization → ProblemCategorySpecialization


---

# 7. ProblemCategory

Категория проблемы.

Таблица:

ProblemCategory

Основные поля:

id  
companyId  
name  
instructions  


Категория содержит инструкции
и связана со специализациями.


Связи:

ProblemCategory → Ticket  
ProblemCategory → ProblemCategorySpecialization


---

# 8. TechnicianSpecialization

Связующая таблица.

Связывает:

User (technician)  
Specialization

Тип связи:

many-to-many


Назначение:

определяет компетенции техников.


---

# 9. ProblemCategorySpecialization

Связующая таблица.

Связывает:

ProblemCategory  
Specialization

Тип связи:

many-to-many


Назначение:

определяет какие специализации
подходят для категории проблемы.


---

# 10. PermissionBlock

Таблица permission системы.

Поля:

id  
code  
name  
description


Примеры:

TICKETS_VIEW  
TICKETS_ASSIGN  
TICKETS_CLAIM  
TICKETS_STATUS_CHANGE  
USERS_MANAGE  


---

# 11. RolePermission

Связь:

role → permissionBlock

Позволяет:

гибко настраивать права ролей.


---

# 12. DomainEvent

Event store системы.

Таблица:

DomainEvent

Поля:

id  
companyId  
entityType  
entityId  
type  
payload  
createdAt  


Примеры событий:

ticket.created  
ticket.assigned  
ticket.claimed  
ticket.status_changed  


Назначение:

- audit log
- аналитика
- SLA engine


---

# 13. Parent / Child Tickets

Ticket поддерживает:

иерархию заявок.

Поле:

parentId


Это позволяет:

- создавать дочерние задачи
- разбивать сложные заявки


---

# 14. Multi-tenant правило

Все таблицы доменной модели
содержат:

companyId


Любой запрос обязан фильтроваться по:

companyId


Нарушение этого правила
ломает безопасность системы.


---

# 15. Автоназначение

Алгоритм использует таблицы:

ProblemCategory  
ProblemCategorySpecialization  
TechnicianSpecialization  


Процесс:

1. определить специализации категории
2. найти техников с этими специализациями
3. выбрать кандидатов


---

# 16. Будущие таблицы

Планируется добавить:

SLA Policy  
Zone  
Territory  
Point  
Workflow  
Attachment  
Comment  
BillingPlan  
Subscription


---

# 17. Важные правила миграций

При изменении schema.prisma:

нельзя:

- удалять поля без анализа
- ломать связи
- менять типы без миграции


AI обязан:

- объяснить влияние изменений
- предложить имя миграции


---

# 18. Архитектурная цель базы данных

База должна поддерживать:

- multi-tenant SaaS
- аналитические запросы
- SLA engine
- workflow engine
- масштабирование
