# PLATFORM ROADMAP — ServiceManager.AI

Версия: 1.0  
Горизонт планирования: 24 месяца

Этот документ описывает стратегию развития платформы
ServiceManager.AI от MVP до enterprise SaaS уровня.

Ориентиры продукта:

Hubex  
Okdesk  
Planado


---

# 1. Текущий уровень системы

Оценка зрелости:

MVP+

Готово:

- multi-tenant архитектура
- JWT authentication
- роли пользователей
- тикет система
- специализации
- категории проблем
- автоназначение
- claim механизм
- ticket board
- domain events
- базовые permission blocks

Не реализовано:

- SLA engine
- workflow engine
- зоны / территории
- аналитический модуль
- файлы / фотографии
- комментарии
- мобильный API
- биллинг


---

# 2. Архитектурная цель

ServiceManager.AI должен стать платформой
управления сервисной сетью.

Основные блоки будущей системы:

Ticket Management  
SLA Engine  
Service Network Model  
Workflow Engine  
Analytics Platform  
Billing System  
Mobile Platform


---

# 3. Этап 1 — Core Platform (0-3 месяца)

Цель:

стабилизировать архитектуру платформы.

### 3.1 Permission система

Задачи:

- завершить PBAC модель
- внедрить PermissionGuard
- убрать жесткие role checks
- внедрить RoleScopePolicy

Результат:

гибкая система прав.


---

### 3.2 Ticket Board

Задачи:

- оптимизация board API
- расширение фильтров
- SLA индикаторы
- быстрый поиск

Результат:

основной интерфейс работы.


---

### 3.3 Domain Events

Задачи:

- покрыть событиями ключевые операции
- ticket.created
- ticket.assigned
- ticket.claimed
- ticket.status_changed

Результат:

audit + аналитика.


---

# 4. Этап 2 — SLA Engine (3-6 месяцев)

Цель:

внедрить управление SLA.

### 4.1 SLA policies

SLA правила:

- response time
- repair time
- escalation rules


---

### 4.2 SLA calculator

Система рассчитывает:

deadline  
atRisk  
breached


---

### 4.3 SLA dashboard

Добавить:

- SLA мониторинг
- оповещения
- просрочки


---

# 5. Этап 3 — Service Network Model (6-9 месяцев)

Цель:

модель сервисной сети.

### 5.1 Zones

Добавить:

Zones  
Territories  
Regions


---

### 5.2 Points

Добавить сущность:

Point

Пример:

магазин  
кафе  
объект


---

### 5.3 Zone assignment

Техники закрепляются за:

- зонами
- территориями


---

# 6. Этап 4 — Workflow Engine (9-12 месяцев)

Цель:

настраиваемые бизнес-процессы.

Workflow позволяет:

- создавать правила обработки заявок
- автоматизировать действия
- строить сценарии


---

Пример:

если:

ticket.priority = HIGH

то:

назначить senior technician


---

# 7. Этап 5 — Analytics Platform (12-18 месяцев)

Цель:

аналитическая система.

### 7.1 Metrics

Добавить метрики:

MTTR  
MTBF  
First Fix Rate  
Technician Performance  
SLA Compliance


---

### 7.2 Dashboard

Добавить:

- операционные dashboards
- управленческие dashboards


---

# 8. Этап 6 — Media System (18-20 месяцев)

Цель:

работа с файлами.

Добавить:

Files  
Photos  
Attachments


---

Функции:

- фото поломок
- фото ремонта
- документы


---

# 9. Этап 7 — Billing Platform (20-22 месяцев)

Цель:

монетизация платформы.

Billing включает:

- тарифы
- лимиты
- платные модули


---

Примеры пакетов:

Basic  
Professional  
Enterprise


---

# 10. Этап 8 — Mobile Platform (22-24 месяцев)

Цель:

мобильное приложение для техников.

Функции:

- просмотр заявок
- навигация
- фото отчеты
- чек-листы


---

# 11. Долгосрочное видение

ServiceManager.AI должен стать
операционной системой сервисной сети.

Функции платформы:

- управление заявками
- управление техниками
- SLA контроль
- аналитика
- управление сетью


---

# 12. Архитектурные принципы роста

Развитие системы должно соблюдать:

multi-tenant архитектуру  
PBAC модель доступа  
Domain Event architecture  
Service Layer принцип  


Нельзя ломать архитектурные инварианты.


---

# 13. Принцип платформы

ServiceManager.AI строится как:

platform-first продукт.

Каждый модуль должен быть:

- масштабируемым
- изолированным
- расширяемым
