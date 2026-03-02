# RBAC_MATRIX (v1) — ServiceManager.AI

## 1. Слои доступа
1. Role = тип пользователя + базовый scope данных
2. Permissions (Blocks) = что можно делать
3. Scope = какие данные видит пользователь

Точки — это scope-настройка. Не роль и не permission.

---

## 2. Роли
- ADMIN
- MASTER (вместо DISPATCHER)
- TECHNICIAN
- CLIENT
- TERRITORIAL_MANAGER
- NETWORK_DIRECTOR
- STAFF

---

## 3. Scope

ADMIN — company-wide  
MASTER — company-wide  
NETWORK_DIRECTOR — company-wide (read-only)  
TECHNICIAN — assigned-only + доступные NEW  
CLIENT — created-by-user (или point-based)  
TERRITORIAL_MANAGER — point-based  
STAFF — company-wide или point-based  

Точки выдаются через UserPointAccess (чекбоксы в карточке пользователя).

---

## 4. Самопринятие заявок

TECHNICIAN:
- видит свои назначенные
- видит NEW доступные
- может принять заявку

Правила:
- только статус NEW
- нельзя перехватывать назначенные
- атомарное принятие
- запись в историю

Фильтр доступных:
- MVP — по специализации
- позже — специализация + точка

---

## 5. Permissions (примеры)

ticket.create
ticket.view
ticket.assign
ticket.status.change
ticket.claim
ticket.urgency.set

points.manage
inventory.manage
inspections.manage
analytics.view
finance.view
finance.manage
users.manage

---

## 6. Правило добавления ролей

Роль добавляется только если меняется scope или тип пользователя.
Функционал добавляется через permissions.
