# TICKET VISIBILITY MATRIX — ServiceManager.AI

Этот документ фиксирует правила доступа к тикетам.

Он является контрактом между:

- backend
- frontend
- permission системой

Документ определяет:

- кто какие тикеты видит
- кто может назначать
- кто может делать claim
- кто может менять статус


---

# 1. Основные статусы тикетов

Система использует следующие статусы:

NEW  
ASSIGNED  
IN_PROGRESS  
DONE  
CANCELED


---

# 2. Основные роли системы

Роли:

ADMIN  
MASTER  
TECHNICIAN  
CLIENT  
NETWORK_DIRECTOR  
STAFF


---

# 3. Visibility matrix

## ADMIN

Видит:

- все тикеты компании

Может:

- создавать тикеты
- назначать техников
- менять статус
- закрывать тикеты
- просматривать аналитику


---

## MASTER

Видит:

- все тикеты компании

Может:

- создавать тикеты
- назначать техников
- менять статус
- управлять заявками


---

## TECHNICIAN

Видит:

- тикеты назначенные ему
- NEW тикеты своей специализации

Не видит:

- чужие назначенные тикеты

Может:

- claim NEW тикеты
- менять статус назначенных тикетов


---

## CLIENT

Видит:

- только свои заявки

Может:

- создавать заявки
- смотреть статус


---

## NETWORK_DIRECTOR

Будущий функционал.

Будет видеть:

- тикеты всей сети
- агрегированную аналитику


---

## STAFF

Видит:

- тикеты в рамках своей роли (ограничено)


---

# 4. Claim правила

Claim доступен только для:

TECHNICIAN

Условия:

- тикет имеет статус NEW
- специализация техника совпадает
- тикет принадлежит той же компании


После claim:

assignedTechnicianId = technicianId  
status = ASSIGNED


---

# 5. Assignment правила

Назначение выполняют:

ADMIN  
MASTER

API:

PUT /tickets/:id/assign/:technicianId


После назначения:

assignedTechnicianId обновляется  
status = ASSIGNED


---

# 6. Status change правила

Изменять статус могут:

ADMIN  
MASTER  
TECHNICIAN (только свои тикеты)


Допустимые переходы:

NEW → ASSIGNED  
ASSIGNED → IN_PROGRESS  
IN_PROGRESS → DONE  
IN_PROGRESS → CANCELED


---

# 7. Ticket Board правила

Board показывает тикеты по колонкам:

NEW  
ASSIGNED  
IN_PROGRESS  
DONE  
CANCELED


Board фильтруется:

по companyId  
по permissions  
по scope


---

# 8. Scope правила

Scope определяет какие данные доступны.

Scope уровни:

ALL  
COMPANY  
ASSIGNED_TO_ME  
CREATED_BY_ME


Пример:

TECHNICIAN:

Permission:

TICKETS_VIEW

Scope:

ASSIGNED_TO_ME


---

# 9. Multi-tenant правило

Все запросы обязаны фильтроваться по:

companyId


Запрещено:

- возвращать тикеты других компаний
- выполнять глобальные выборки


---

# 10. Архитектурное значение документа

Этот документ используется для:

- реализации RoleScopePolicy
- настройки PermissionBlocks
- определения поведения Ticket Board
- согласования frontend и backend логики


---

# 11. Источник истины

Этот документ является:

контрактом поведения системы.

Любые изменения доступа к тикетам должны
сначала обновлять этот документ,
а затем код системы.
