# RBAC_MATRIX (v1) — ServiceManager.AI

## 1. Слои доступа
1. **Role** = тип пользователя + базовый scope данных
2. **Permissions (Blocks / PBAC)** = что можно делать (что проходит PermissionsGuard)
3. **Scope (Policy/Service)** = какие данные видит пользователь внутри companyId

Точки — это scope-настройка. Не роль и не permission.

---

## 2. Роли (текущий enum)
- ADMIN
- MASTER
- DISPATCHER
- NETWORK_DIRECTOR
- TECHNICIAN
- CLIENT
- TERRITORIAL_MANAGER
- STAFF

---

## 3. Scope (MVP)
- **ADMIN** — company-wide
- **MASTER** — company-wide
- **DISPATCHER** — company-wide (операционное управление)
- **NETWORK_DIRECTOR** — company-wide (управленческий, ограниченная запись)
- **TECHNICIAN** — assigned-only + доступные NEW (available)
- **CLIENT** — created-by-user (или point-based, позже)
- **TERRITORIAL_MANAGER** — point-based (позже)
- **STAFF** — company-wide или point-based (позже)

Точки выдаются через UserPointAccess (чекбоксы в карточке пользователя) — планируемый механизм.

---

## 4. Самопринятие заявок (claim)
TECHNICIAN:
- видит свои назначенные
- видит NEW доступные (available)
- может принять заявку (claim)

Правила:
- только статус NEW
- нельзя перехватывать уже назначенные
- атомарное принятие
- запись в историю

Фильтр доступных:
- MVP — по специализации
- позже — специализация + точка

---

## 5. Permission Blocks (PBAC codes, v1)

### Tickets
- **TICKETS_CREATE** — создание тикетов и child тикетов
- **TICKETS_VIEW** — просмотр списка и карточки тикета (scope решается в policy/service)
- **TICKETS_VIEW_AVAILABLE** — просмотр “доступных NEW” для TECHNICIAN
- **TICKETS_CLAIM** — self-assign доступного NEW тикета
- **TICKETS_ASSIGN** — назначение тикета на техника (оператор/админ)
- **TICKETS_STATUS_CHANGE** — смена статуса (enforcement деталей может быть в service/policy)

### Analytics
- **ANALYTICS_VIEW** — доступ к аналитике (overview)

### Future-friendly (seeded, но может быть не подключено контроллерами)
- **USERS_MANAGE** — создание/редактирование пользователей
- **COMPANY_SETTINGS_EDIT** — изменения настроек компании (например auto-assign)

---

## 6. Матрица прав по ролям (v1)

ADMIN:
- TICKETS_CREATE
- TICKETS_VIEW
- TICKETS_ASSIGN
- TICKETS_STATUS_CHANGE
- ANALYTICS_VIEW
- USERS_MANAGE
- COMPANY_SETTINGS_EDIT

MASTER:
- TICKETS_CREATE
- TICKETS_VIEW
- TICKETS_ASSIGN
- TICKETS_STATUS_CHANGE
- ANALYTICS_VIEW

DISPATCHER:
- TICKETS_CREATE
- TICKETS_VIEW
- TICKETS_ASSIGN
- TICKETS_STATUS_CHANGE

NETWORK_DIRECTOR:
- TICKETS_VIEW
- TICKETS_STATUS_CHANGE
- ANALYTICS_VIEW

TECHNICIAN:
- TICKETS_VIEW
- TICKETS_VIEW_AVAILABLE
- TICKETS_CLAIM
- TICKETS_STATUS_CHANGE

CLIENT:
- (пока пусто, будет после определения модели клиентского доступа)

TERRITORIAL_MANAGER:
- (пока пусто, будет после point-based модели)

STAFF:
- (пока пусто, будет после определения scope)

---

## 7. Правило добавления ролей
Роль добавляется только если меняется **scope** или **тип пользователя**.
Функционал добавляется через **permissions**.
