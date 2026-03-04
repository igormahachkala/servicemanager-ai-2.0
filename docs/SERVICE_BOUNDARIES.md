# SERVICE BOUNDARIES — ServiceManager.AI

Этот документ описывает границы сервисов системы.

Цель документа:

- определить доменные зоны системы
- предотвратить смешивание ответственности модулей
- упростить масштабирование архитектуры


---

# 1. Архитектурный подход

ServiceManager.AI построен по принципам:

Domain Driven Design (DDD)

Система разделена на:

Bounded Contexts.


Каждый контекст отвечает за свою область логики.


---

# 2. Основные доменные зоны

Платформа разделена на следующие зоны:

Identity Domain  
Company Domain  
Ticket Domain  
Workforce Domain  
Permission Domain  
Event Domain  
Analytics Domain


---

# 3. Identity Domain

Отвечает за:

аутентификацию пользователей.


Модуль:

auth


Функции:

- регистрация
- логин
- выдача JWT
- идентификация пользователя


API:

POST /auth/register  
POST /auth/login  
GET /auth/me


---

# 4. Company Domain

Отвечает за:

данные компании.


Модуль:

company


Функции:

- настройки компании
- автоназначение
- конфигурация системы


API:

GET /company  
PATCH /company/auto-assign


---

# 5. Ticket Domain

Центральный домен системы.

Модуль:

tickets


Функции:

- создание тикетов
- управление статусами
- назначение техников
- claim механизм
- board


Основные API:

POST /tickets  
GET /tickets  
GET /tickets/:id  
POST /tickets/:id/claim  
PUT /tickets/:id/assign/:technicianId  
PATCH /tickets/:id/status  
GET /tickets/board


---

# 6. Workforce Domain

Отвечает за техников и компетенции.


Модули:

users  
technicians  
specializations


Функции:

- управление пользователями
- управление техниками
- управление специализациями


Связи:

Technician → Specialization


---

# 7. Problem Domain

Отвечает за классификацию проблем.


Модуль:

problem-categories


Функции:

- категории проблем
- инструкции
- связь с специализациями


Используется в:

ticket assignment


---

# 8. Permission Domain

Отвечает за систему прав.


Модуль:

permissions


Функции:

- permission blocks
- role permissions
- проверка доступов


Основной guard:

PermissionGuard


---

# 9. Event Domain

Отвечает за Event Store.


Модуль:

events


Функции:

- запись событий
- audit log
- источник аналитики


Таблица:

DomainEvent


---

# 10. Analytics Domain (future)

Будущий домен.

Будет отвечать за:

- метрики
- dashboards
- SLA анализ


---

# 11. SLA Domain (future)

Будущий домен.

Будет отвечать за:

- SLA policies
- deadline calculation
- breach detection


---

# 12. Billing Domain (future)

Будущий домен.

Будет отвечать за:

- тарифы
- подписки
- биллинг


---

# 13. Domain dependencies

Зависимости доменов:


Ticket Domain  
→ Workforce Domain  
→ Problem Domain  
→ Permission Domain  
→ Event Domain


Workforce Domain  
→ Company Domain


Permission Domain  
→ Identity Domain


---

# 14. Что запрещено

Нельзя:

- смешивать домены
- делать cross-module логику
- обращаться напрямую к чужим таблицам


Взаимодействие должно происходить через:

service layer.


---

# 15. Граница модулей

Каждый модуль должен:

- иметь свой service
- иметь свой controller
- иметь DTO


Модули должны быть:

изолированными.


---

# 16. Архитектурная цель

ServiceManager.AI должен развиваться
как модульная SaaS платформа.

Это позволит в будущем:

- разделять сервисы
- масштабировать систему
- внедрять новые домены
