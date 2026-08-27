# SCALING STRATEGY — ServiceManager.AI

Этот документ описывает стратегию масштабирования платформы.

Цель документа:

- подготовить систему к росту
- избежать архитектурных тупиков
- определить этапы масштабирования


---

# 1. Текущий уровень архитектуры

ServiceManager.AI сейчас является:

Modular Monolith.

Архитектура:

NestJS  
Prisma  
PostgreSQL  
Docker


Это оптимальная архитектура для:

MVP  
раннего SaaS  
быстрой разработки


---

# 2. Принцип масштабирования

Система должна масштабироваться постепенно.

Этапы роста:

Stage 1 — Modular Monolith  
Stage 2 — Optimized Monolith  
Stage 3 — Distributed Services  
Stage 4 — Platform Architecture


Нельзя преждевременно переходить
к микросервисам.


---

# 3. Stage 1 — Modular Monolith

Текущий этап.

Особенности:

- один backend
- одна база данных
- модули внутри NestJS


Преимущества:

- простая разработка
- высокая скорость
- минимальная сложность


---

# 4. Stage 2 — Optimized Monolith

Когда переходить:

100+ компаний  
50k+ тикетов в месяц


Добавляется:

### 4.1 Redis cache

Используется для:

- board cache
- session cache
- rate limiting


---

### 4.2 Query optimization

Добавляются:

- индексы
- pagination
- optimized queries


---

### 4.3 Background jobs

Добавляется:

job queue


Используется для:

- SLA calculation
- аналитики
- отправки уведомлений


Рекомендуемые технологии:

BullMQ  
Redis


---

# 5. Stage 3 — Distributed Services

Когда переходить:

1000+ компаний  
миллионы тикетов


Система начинает разделяться
на сервисы.


Основные кандидаты
для выделения сервисов:

Ticket Service  
Analytics Service  
Notification Service  
File Service


---

# 6. Stage 4 — Platform Architecture

Когда переходить:

enterprise масштаб.


Система становится
платформой сервисов.


Добавляются:

API Gateway  
Event Bus  
Service Mesh


---

# 7. Event driven architecture

DomainEvent уже используется
как Event Store.


Будущий шаг:

перевести события
в Event Bus.


Технологии:

Kafka  
NATS  
RabbitMQ


---

# 8. Scaling database

PostgreSQL может масштабироваться
достаточно долго.


Этапы:

Stage 1:

одна база


Stage 2:

read replicas


Stage 3:

sharding


---

# 9. Scaling API

API масштабируется через:

horizontal scaling.


Backend контейнеры:

backend-1  
backend-2  
backend-3


Балансировка:

load balancer


---

# 10. File storage

Файлы не должны храниться
в базе данных.


Использовать:

S3 storage


Примеры:

AWS S3  
MinIO


---

# 11. Caching strategy

Кэш используется для:

ticket board  
analytics  
configuration


Технология:

Redis


---

# 12. Queue architecture

Очереди используются для:

уведомлений  
аналитики  
SLA engine  
workflow engine


Рекомендуемые технологии:

BullMQ  
RabbitMQ


---

# 13. Monitoring

Для production системы
необходимо добавить мониторинг.


Инструменты:

Prometheus  
Grafana


---

# 14. Logging

Централизованные логи.

Инструменты:

ELK stack


---

# 15. Архитектурная цель

ServiceManager.AI должен масштабироваться
до уровня enterprise SaaS.


Архитектура должна поддерживать:

- миллионы заявок
- тысячи компаний
- распределенную систему
