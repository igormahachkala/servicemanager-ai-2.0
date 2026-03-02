# TICKET VISIBILITY MATRIX v2
ServiceManager.AI

Цель: Зафиксировать ожидаемое поведение доступа к тикетам для ВСЕХ ролей.
Матрица = контракт. Любые изменения → обновить матрицу + e2e тесты.

---

# 1) READ (list/get)

| Role               | Scope (что видит)                         | Комментарий |
|--------------------|-------------------------------------------|-------------|
| ADMIN              | ALL                                       | Полный доступ внутри company |
| NETWORK_DIRECTOR   | ALL                                       | Руководитель сети: полный обзор внутри company |
| TERRITORIAL_MANAGER| ALL (пока)                                | MVP: пока без зон → все тикеты. Позже станет ZONE/POINT scoped |
| MASTER             | ALL                                       | Оперативное управление |
| DISPATCHER         | ALL                                       | Для совместимости: ведёт себя как MASTER (пока) |
| STAFF              | ALL (read-only по умолчанию)              | Служебная роль: читает, но действия выдаются блоками |
| TECHNICIAN         | ALL within company (READ расширен)        | Важно: чтение шире, но изменения только своей |
| CLIENT             | CREATED_BY_ME (позже: по pointId)          | Клиент видит только свои заявки |

---

# 2) CREATE (создание заявок)

| Role               | Allowed | Комментарий |
|--------------------|---------|-------------|
| ADMIN              | YES     | |
| NETWORK_DIRECTOR   | YES     | |
| TERRITORIAL_MANAGER| YES     | |
| MASTER             | YES     | |
| DISPATCHER         | YES     | |
| STAFF              | OPTIONAL| Только если дан permission (TICKETS_CREATE) |
| TECHNICIAN         | OPTIONAL| Иногда нужно “создать дочернюю/сопутствующую” — через permission |
| CLIENT             | YES     | Основная функция клиента |

---

# 3) ASSIGN (назначение техника)

| Role               | Allowed | Комментарий |
|--------------------|---------|-------------|
| ADMIN              | YES     | |
| NETWORK_DIRECTOR   | YES     | |
| TERRITORIAL_MANAGER| YES     | |
| MASTER             | YES     | |
| DISPATCHER         | YES     | Совместимость |
| STAFF              | OPTIONAL| Только если дан permission (TICKETS_ASSIGN) |
| TECHNICIAN         | NO      | Не назначает других |
| CLIENT             | NO      | |

---

# 4) CLAIM (техник забирает NEW)

| Role               | Allowed | Правило |
|--------------------|---------|--------|
| TECHNICIAN         | YES     | Только NEW + matching specialization |
| ADMIN              | OPTIONAL| Обычно не нужно, но можно разрешить |
| MASTER             | OPTIONAL| Можно использовать как “назначить себя” |
| DISPATCHER         | OPTIONAL| |
| TERRITORIAL_MANAGER| OPTIONAL| |
| NETWORK_DIRECTOR   | OPTIONAL| |
| STAFF              | OPTIONAL| |
| CLIENT             | NO      | |

---

# 5) STATUS_CHANGE (смена статуса)

| Role               | Allowed | Правило |
|--------------------|---------|--------|
| ADMIN              | YES     | Любые тикеты |
| NETWORK_DIRECTOR   | YES     | Любые тикеты |
| TERRITORIAL_MANAGER| YES     | Любые тикеты (позже: scoped) |
| MASTER             | YES     | Любые тикеты |
| DISPATCHER         | YES     | Как MASTER |
| STAFF              | OPTIONAL| Только при наличии permission (TICKETS_STATUS_CHANGE) |
| TECHNICIAN         | YES     | Только assigned to self |
| CLIENT             | NO      | (позже: может отменить/комментировать по правилам) |

---

# 6) EDIT (правка полей заявки: адрес/описание/категория)

| Role               | Allowed | Правило |
|--------------------|---------|--------|
| ADMIN              | YES     | Любые тикеты |
| NETWORK_DIRECTOR   | YES     | Любые тикеты |
| TERRITORIAL_MANAGER| YES     | Любые тикеты (позже: scoped) |
| MASTER             | YES     | Любые тикеты |
| DISPATCHER         | YES     | |
| STAFF              | OPTIONAL| По permission |
| TECHNICIAN         | OPTIONAL| Только если разрешим (обычно: ограниченно, например “комментарий/факт работ”) |
| CLIENT             | OPTIONAL| Только до назначения / по правилам (позже) |

---

# 7) CHILD TICKETS (создание дочерней заявки)

| Role               | Allowed | Комментарий |
|--------------------|---------|-------------|
| ADMIN              | YES     | |
| NETWORK_DIRECTOR   | YES     | |
| TERRITORIAL_MANAGER| YES     | |
| MASTER             | YES     | Основной сценарий “не заполнять заново” |
| DISPATCHER         | YES     | |
| STAFF              | OPTIONAL| По permission |
| TECHNICIAN         | OPTIONAL| Полезно в полях, но через permission |
| CLIENT             | NO/OPTIONAL | Обычно нет, но можно разрешить как расширение |

---

# 8) ИНВАРИАНТЫ (не обсуждаются)

1) Любая операция — строго внутри companyId  
2) Guard (PBAC) отвечает только “можно/нельзя действие”  
3) Policy (RoleScopePolicy) отвечает “какие данные” и “какие ограничения”  
4) TECHNICIAN: чтение можно расширять, изменения — только своей (assigned)  
5) Любое изменение матрицы → обновить e2e тесты и docs/PLATFORM_CONSTITUTION_V2.md (если изменили контракт)

---

# 9) ПРИМЕЧАНИЕ ПРО БУДУЩЕЕ (zones/points)

Когда появятся zones/points:
- TERRITORIAL_MANAGER станет scoped: POINTS_IN_ZONE / ZONES_ASSIGNED
- NETWORK_DIRECTOR может остаться ALL
- CLIENT может стать scoped: own pointId
