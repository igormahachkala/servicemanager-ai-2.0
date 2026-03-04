# MODULE MAP — ServiceManager.AI

Этот документ описывает структуру backend модулей системы.

Backend построен на:

NestJS modular architecture.

Каждый модуль содержит:

controller  
service  
dto  
module  


---

# 1. Общая структура проекта

backend/

src/

auth/  
users/  
company/  
tickets/  
specializations/  
problem-categories/  
technicians/  
permissions/  
events/  
prisma/  

common/


---

# 2. Auth Module

Путь:

src/auth

Файлы:

auth.controller.ts  
auth.service.ts  
auth.module.ts  

dto/

login.dto.ts  
register.dto.ts  


Назначение:

- регистрация компаний
- логин пользователей
- выдача JWT


API:

POST /auth/register  
POST /auth/login  
GET /auth/me  


---

# 3. Users Module

Путь:

src/users

Назначение:

управление пользователями компании.

Основные роли:

ADMIN  
MASTER  
TECHNICIAN  
CLIENT  
NETWORK_DIRECTOR  
STAFF


Основные операции:

- создание пользователей
- список пользователей
- управление ролями


---

# 4. Company Module

Путь:

src/company

Назначение:

настройки компании.

Основные функции:

- получение информации о компании
- включение автоназначения


API:

GET /company  
PATCH /company/auto-assign  


---

# 5. Tickets Module

Путь:

src/tickets

Это центральный модуль системы.

Основные функции:

- создание тикетов
- назначение техников
- claim механизм
- изменение статусов
- ticket board


Основные API:

POST /tickets  
GET /tickets  
GET /tickets/:id  
PUT /tickets/:id/assign/:technicianId  
POST /tickets/:id/claim  
PATCH /tickets/:id/status  
GET /tickets/board  


---

# 6. Specializations Module

Путь:

src/specializations

Назначение:

управление специализациями.

Примеры:

- электрика
- IT
- холодильное оборудование


---

# 7. Problem Categories Module

Путь:

src/problem-categories

Назначение:

категории проблем.

Категория содержит:

- название
- инструкции
- связанные специализации


Используется для:

- автоназначения
- аналитики


---

# 8. Technicians Module

Путь:

src/technicians

Назначение:

управление техниками.

Функции:

- список техников
- привязка специализаций
- поиск кандидатов


Используется в:

Ticket assignment.


---

# 9. Permissions Module

Путь:

src/permissions

Назначение:

PBAC система.

Основные сущности:

PermissionBlock  
RolePermission  


Функции:

- управление permission блоками
- проверка доступов


Guard:

PermissionGuard


---

# 10. Events Module

Путь:

src/events

Назначение:

Domain Event Store.

Любое важное действие записывается
в таблицу:

DomainEvent


Примеры событий:

ticket.created  
ticket.assigned  
ticket.claimed  
ticket.status_changed  


---

# 11. Prisma Module

Путь:

src/prisma

Назначение:

работа с базой данных.

Файл:

prisma.service.ts

Используется всеми сервисами.


---

# 12. Common Module

Путь:

src/common

Содержит:

guards  
decorators  
constants  
utils  


Примеры:

PermissionGuard  
permission.constants.ts  


---

# 13. Основные зависимости модулей

Auth → Users  
Users → Company  

Tickets → Users  
Tickets → Technicians  
Tickets → ProblemCategories  
Tickets → Specializations  
Tickets → Events  
Tickets → Permissions  


Technicians → Specializations  

ProblemCategories → Specializations  


---

# 14. Центральные модули системы

Ключевые модули:

Tickets  
Permissions  
Events  


Они формируют ядро платформы.


---

# 15. Принцип развития модулей

Новый модуль должен:

1. иметь собственный сервис
2. иметь DTO
3. быть подключен в AppModule
4. соблюдать multi-tenant архитектуру


Запрещено:

- смешивать модули
- писать бизнес-логику в controller


---

# 16. Архитектурная цель

Модули должны оставаться:

- изолированными
- расширяемыми
- независимыми

Это позволяет системе масштабироваться
как enterprise SaaS платформа.
