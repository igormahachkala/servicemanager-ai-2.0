# Mobile Backend Requirements V1

**Артефакт для согласования с management-потоком (ChatGPT).**
Дата: 2026-07-08 · Автор: mobile-поток · Ветка: `integration/permissions+acceptance`

Единый реестр всех backend-зависимостей мобильного потока (`/m`), накопленных за блоки A–C редизайна Mobile UX V2. Каждая мобильная фича, упирающаяся в бэкенд, сведена сюда с диагностикой и предлагаемым контрактом, чтобы management-поток мог оценить и распределить.

> **Правило зоны:** всё в этом документе — **shared zone / backend**. Mobile-поток НЕ пишет это в одиночку. Реализует management-поток ЛИБО mobile-агент **только по согласованию**. Фронт-обёртки, помеченные `[ФРОНТ]`, mobile-поток берёт на себя после появления контракта.

## Легенда
- **Приоритет:** `P0` ломает прод · `P1` разблокирует готовый фронт · `P2` новые модули (блок D)
- **Размер:** `S` (≤0.5 дня) · `M` (0.5–2 дня) · `L` (>2 дней / новая доменная модель)
- **Зона:** `mgmt` (management-поток) · `mobile*` (mobile-агент по согласованию) · `[ФРОНТ]` (чистый фронт, ждёт контракт)

---

# P0 — ломает текущий прод (чинить первым)

## P0.0 — 🔴 SECURITY: утечка изоляции контуров (SECONDARY technician видит весь board клиента)

- **Что нужно:** применить SECONDARY operational-restriction и к роли `TECHNICIAN` в board-запросе (сейчас она обходится). Это **утечка данных — наивысший приоритет**, выше всех остальных пунктов.
- **Зачем:** техник субподрядчика (SECONDARY-провайдер, у компании ServiceContract с клиентом) на главной / «Мои заявки» / чатах видит **ВСЕ заявки клиента по всем объектам**, а по бизнес-логике должен видеть только назначенное ему / исполнителям своей компании + локации, привязанные к SECONDARY. Межтенантная утечка операционных данных клиента субподрядчику.
- **Текущее состояние (диагностика 2026-07-08, только чтение):**
  - Течёт **в бэкенде**, не во фронте. Фронт (`web/src/mobile/home/MobileHome.tsx`, `MobileMyTickets.tsx`) шлёт `api.board({linkedClientCompanyId, companyId, take})` **без `assigneeId`** и сознательно делегирует скоуп бэку (комментарий в коде `MobileHome.tsx:97-99`).
  - **Корень: `backend/src/tickets/tickets.query.service.ts:~258`** — `resolveSecondaryOperationalWhere()` делает `if (params.technicianScope) return null` → для роли `TECHNICIAN` SECONDARY-сужение **не применяется**. Для не-техников (ADMIN и т.п.) `technicianScope=null` → ограничение работает корректно.
  - `buildTechnicianBoardQuery` (`tickets.query.service.ts:87-188`): `companyIds` включает **клиентскую компанию целиком** (`ticket-access.utils.ts:~276`, `linkedClientIds=[requestedLinked]` одинаково для PRIMARY и SECONDARY); видимость = `{assignedTechnicianId:me}` ∪ `{status:NEW, assignedTechnicianId:null}` по обеим компаниям → все NEW-неназначенные заявки клиента.
  - **Локация-скоуп техника пустой** (`tickets.query.service.ts:356-363` захардкожен `tenant_wide`; `buildTechnicianLocationRestrictionWhere:141-142` при пустых привязках) → фильтра по объектам нет.
  - PRIMARY vs SECONDARY для техника **не различаются**, хотя намерение SECONDARY-сужения задокументировано в docstring `ticket-access.utils.ts:243-267`.
  - **Стейдж-подтверждение:** PRIMARY=Test Provider A→Test Client A; SECONDARY=Test Provider B→Test Client A (79 заявок). API-репро как ADMIN of SECONDARY (`secondary.provider@test.local`) с контуром клиента → board вернул **ровно 1** (только назначенную) → SECONDARY-ограничение для не-техника работает → дыра именно в техник-ветке. (Техника у SECONDARY на стейдже нет — прямой техник-репро требует создать техника, пока не делали.)
- **Бизнес-решение (утверждено):** видимость SECONDARY-техника ДОЛЖНА быть **строго**:
  1. заявки, назначенные **лично ему**;
  2. заявки, назначенные **его SECONDARY-компании / её исполнителям**;
  3. **NEW/неназначенные** заявки — **ТОЛЬКО на локациях в рамках SECONDARY-сервис-контракта**;
  4. **НЕТ** заявок на объектах клиента вне SECONDARY-скоупа;
  5. **НЕТ** полного клиентского board.
- **СТАТУС (2026-07-08):** APPROVED **только на документацию/финализацию диагноза и плана**. Backend **НЕ кодить**; изменение `tickets.query.service.ts` / `ticket-access.utils.ts` требует **явного отдельного одобрения management ПОСЛЕ этого документа** (подтверждено ChatGPT-потоком).

- **Схема (проверено): миграция НЕ требуется для фикса.**
  - `ServiceContract` — **без** связи с локациями (нет `locations`/`locationIds`); моделей `ContractLocation`/`ServiceContractLocation`/`ProviderLocation` **нет**. `Location` → только `clientCompanyId`. `Ticket` → нет `assignedCompanyId` (провайдер выводится через компанию `assignedTechnicianId`).
  - Привязка провайдер↔локации существует в данных без новой модели: (1) `UserLocationBinding` (per-user, `companyId`=провайдер, `location.clientCompanyId`=клиент) — уже используется в `buildSecondaryOperationalScopeWhere`; (2) неявно через `Ticket.locationId` назначенных заявок.
  - ⚠️ Оговорка данных: на стейдже `UserLocationBinding` фактически пуст (1 всего, 0 у SECONDARY) → «обслуживаемые локации» через привязки на практике не заполнены (см. OPEN QUESTION).

- **Предлагаемый фикс (контракт, код НЕ писать — pending approval). Две части:**
  - **(A) Убрать техник-обход** в `resolveSecondaryOperationalWhere` (`tickets.query.service.ts:258`, `if (params.technicianScope) return null`) → применять SECONDARY-сужение и к роли TECHNICIAN. Корректный операционный where **уже существует** — `buildSecondaryOperationalScopeWhere` (`ticket-access.utils.ts:466-498`): `{assignedTechnicianId ∈ SECONDARY-исполнители} OR {locationId ∈ SECONDARY-локации(из UserLocationBinding)}`, и он **уже location-aware**. Для PRIMARY-контракта `buildSecondaryOperationalTicketWhere` возвращает `null` → PRIMARY-техник **не регрессирует**.
  - **(B) Клампинг локаций техника.** Итоговый board техника = `SECONDARY-локации ∩ (assignedTechnicianId=me ∪ NEW-в-этих-локациях)`. Т.к. `buildSecondaryOperationalScopeWhere` уже содержит `{locationId ∈ boundLocations}`, применение (A) само по себе клампит NEW к SECONDARY-локациям — **отдельная правка `tenant_wide` (`:356-363`) вероятно избыточна**; подтвердить тестом. Клиентская компания не должна давать технику полный board — доступ только через операционный where.
  - **Регресс-тесты:** (1) SECONDARY-техник НЕ видит заявки вне SECONDARY-скоупа; (2) NEW — только на SECONDARY-локациях; (3) видит назначенное себе + NEW в этих локациях; (4) ADMIN и TECHNICIAN одной SECONDARY-компании — один локация-скоуп; (5) PRIMARY-техник — прежний широкий доступ (не регресс).

- **🟡 OPEN PRODUCT QUESTIONS (решить до кода):**
  1. **Источник «обслуживаемых объектов» / NEW-прокси:** строгий прокси (NEW видны только там, где у субподрядчика уже есть назначенные заявки / `UserLocationBinding`) — тогда фикс на существующих данных, но пустые привязки ⇒ субподрядчик не видит новой claimable-работы; ИЛИ нужен **отдельный источник обслуживаемых объектов** (заполнение `UserLocationBinding` процессом, либо новая модель контракт↔локация = отдельная миграция/фаза).
  2. **Мульти-контракт (несколько клиентов):** сужать по **активному контуру** (текущий `linkedClientCompanyId`) или объединять все SECONDARY-контуры?

- **OWNERSHIP:** файлы `tickets.query.service.ts`, `ticket-access.utils.ts` — **зона backend/management**. Изменение кода — только после **явного одобрения management**. Кто реализует (mobile-поток по делегированию или management) — решается на согласовании ПОСЛЕ этого документа.

- **Сверка ссылок (важно перед кодом):** символы, названные в approval ChatGPT-потоком (`resolveTechnicianAssignedLocationIds()`, `resolveViewerBoard`, строки `:186-190`), в текущем checkout `feature/management-console-v2-clean` **не найдены** (греп по backend+frontend — ноль; `:186-190` = конец `buildTechnicianBoardQuery`). Проверенные по факту чтения точки: **`tickets.query.service.ts:258`** (`resolveSecondaryOperationalWhere` обход), **`ticket-access.utils.ts:466-498`** (`buildSecondaryOperationalScopeWhere`, готовый location-aware where), `:356-363` (`tenant_wide`), `ticket-access.utils.ts:276/288` (`companyIds` включает клиента). Перед кодом — **свериться с management на одной версии символов/строк** (возможно ChatGPT смотрел иную ветку/состояние).

- **Приоритет / зона:** **P0 (security, выше P0.1)** · `M` · `mgmt` · **код pending management approval**.
- **Зависимости:** нет (изолированная scope-логика). Точки: `tickets.query.service.ts:258` + `ticket-access.utils.ts:466-498` (+ возможно `:356-363`).

## P0.1 — CHAT-purpose для вложений чата

- **Что нужно:** значение `CHAT` (или `GENERAL`) в enum `TicketAttachmentPurpose` + приём параметра `purpose` в `POST /tickets/:id/attachments`.
- **Зачем:** блок B доп. Ч.2 (фото в чате, коммиты `537c42e`/`0749f25`). Фото, отправленное из **композера чата**, сейчас попадает в отчёт о работе → искажает фото-отчёты (WORK_REPORT) и приёмку. Это единственный P0 — уже в проде, тихо портит данные отчётов.
- **Текущее состояние:**
  - enum `TicketAttachmentPurpose = REQUEST | WORK_REPORT | DECLINE_REPORT` (`backend/prisma/schema.prisma:59-63`) — **нет** не-отчётного значения.
  - `POST /tickets/:id/attachments` (`tickets.controller.ts:266-285`) параметр `purpose` **не принимает**.
  - Сервис `uploadToTicket` (`ticket-attachments.service.ts:141-158`) **жёстко** ставит `purpose: WORK_REPORT` (L157).
  - Фронт `uploadTicketAttachment` (`api.ts:2413`) purpose не шлёт; `handleTicketAddPhotos` (`MobileTicketPage.tsx:683`) — ОБЩИЙ для композера чата и вкладки Фото → оба = WORK_REPORT.
  - **Чистого фронт-фикса нет:** эндпоинт не принимает purpose И нет не-отчётного значения enum.
- **Предлагаемый контракт:**
  ```prisma
  enum TicketAttachmentPurpose {
    REQUEST
    WORK_REPORT
    DECLINE_REPORT
    CHAT            // новое: вложение переписки, НЕ отчёт
  }
  ```
  ```ts
  // POST /tickets/:id/attachments  (multipart)
  // body: file + purpose?: 'REQUEST' | 'WORK_REPORT' | 'DECLINE_REPORT' | 'CHAT'
  class UploadTicketAttachmentDto {
    purpose?: TicketAttachmentPurpose // default остаётся текущим (WORK_REPORT) для обратной совместимости вкладки Фото
  }
  // Фронт из композера чата шлёт purpose='CHAT'; вкладка Фото и «Отправить на приёмку» — без изменений.
  ```
  Отчёт остаётся **только** через осознанное действие «Отправить на приёмку». Миграция бэкфилла не требуется (новые загрузки размечаются корректно; исторические чат-фото остаются WORK_REPORT — при желании отдельный скрипт по event `ticket.attachment_uploaded` из ленты чата).
- **Приоритет / зона:** `P0` · `S` · `mgmt` (enum-миграция + DTO + сервис) + `[ФРОНТ]` (передать purpose из композера — 1 строка).
- **Зависимости:** нет. Разблокирует P1.7 (attachment↔comment) и «все фото заявки в ленте».

---

# P1 — доработки существующих сущностей (разблокируют готовый фронт)

## P1.1 — `lastRejectedAt` на Ticket + отдача в board

- **Что нужно:** поле `lastRejectedAt: DateTime?` (или `wasRejected: Boolean` / `rejectionCount: Int`) на модели `Ticket` + отдача в board-ответе (`TicketsQueryService.board`).
- **Зачем:** блок E, карта «Требуют доработки» (E2, коммит `137bd5e`). Заменит промежуточный фронт-костыль.
- **Текущее состояние (фронт-костыль):** статуса `REJECTED` в модели НЕТ (TicketStatus = NEW/ASSIGNED/IN_PROGRESS/AWAITING_ACCEPTANCE/DONE/CANCELED); клиентский reject (`decision=REJECT`) возвращает заявку в `IN_PROGRESS` (`tickets.acceptance.service.ts:93-108`). Признак «вернули на доработку» сейчас детектится на фронте как: board-заявка `status===IN_PROGRESS` И есть нотификация `type==='ticket.rejected'` (`entityId=ticketId`) из `GET /notifications` (take:100). Ограничения костыля: нотификации капаются (старый reject теряется), `ticket.rejected` летит только если `assignedTechnicianId` задан, удаление нотификации теряет сигнал.
- **Предлагаемый контракт:**
  ```prisma
  model Ticket {
    // ...
    lastRejectedAt DateTime?   // ставится в acceptance.service при decision=REJECT
    rejectionCount Int      @default(0)
  }
  ```
  ```ts
  // BoardResponse.columns[].cards[] (TicketCard) добавить:
  lastRejectedAt?: string | null
  // Детект на фронте становится O(1) без /notifications:
  //   card.status === 'IN_PROGRESS' && card.lastRejectedAt != null
  ```
- **Приоритет / зона:** `P1` · `M` · `mgmt` (поле + запись в acceptance.service + board projection).
- **Зависимости:** нет. После — mobile-поток убирает нотификационный детект.

## P1.2 — Аналитика: период + дельты на `/analytics/overview`

- **Что нужно:** параметры `from`/`to` + сравнение с предыдущим периодом (дельты) на `GET /analytics/overview`.
- **Зачем:** блок C (аналитика). Прототип V2 Final рисует KPI с дельтами («+8%», «−0.4ч»); у нас на их месте **честные пропуски** (нет данных). Также период-чипы 7/30/90/365/custom сейчас применяются только к locations-данным, а SLA%/сроки из overview — «за всё окно» (помечено).
- **Текущее состояние:** `GET /analytics/overview` → `analyticsOverview()` считает по **окну 2000 последних** заявок, **from/to не принимает**, сравнения периодов нет. ADMIN-only (403 иначе).
- **Предлагаемый контракт:**
  ```ts
  // GET /analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
  // ответ дополнить блоком сравнения с предыдущим равным периодом:
  type AnalyticsOverviewResponse = {
    // ...существующее (createdCount, sla, timing, ...)
    period?: { from: string; to: string }
    previous?: {                 // тот же расчёт за [from - (to-from), from]
      createdCount: number
      sla: { okPercent?: number }
      timing: { meanTimeToResolveMinutes: number }
      breachedCount: number
    }
    // фронт сам считает дельту current - previous
  }
  ```
- **Приоритет / зона:** `P1` · `M` · `mgmt`.
- **Зависимости:** нет.

## P1.3 — Аналитика: `/analytics/contractors`

- **Что нужно:** новый эндпоинт `GET /analytics/contractors` — throughput + SLA по подрядчикам (+ рейтинг, если вводим сущность рейтинга).
- **Зачем:** блок C, представление «Подрядчики» — сейчас **заглушка** «после доработки API» (C2.5, коммит `a921c20`), без цифр.
- **Текущее состояние:** per-contractor данных в API **нет вообще**. Единственный контур подрядчика — scope `linkedClientCompanyId` (уровень сервис-контракта), не разбивка. board `TicketCard` **не содержит** contractor/provider.
- **Предлагаемый контракт:**
  ```ts
  // GET /analytics/contractors?from&to&linkedClientCompanyId
  type ContractorAnalyticsResponse = {
    items: Array<{
      contractorCompanyId: string
      contractorName: string
      doneCount: number          // throughput за период
      slaOkPercent: number | null
      rating?: number | null     // опционально, если появится сущность оценки
    }>
    meta: { scopeCompanyId?: string }
  }
  ```
- **Приоритет / зона:** `P1` · `M` (или `L`, если вводим сущность рейтинга) · `mgmt`.
- **Зависимости:** рейтинг опционален; базовый throughput/SLA независим.

## P1.4 — Аналитика: полный `byDay`-тренд по всем источникам

- **Что нужно:** дневной ряд заявок по **всем** источникам (не только public intake) в `/analytics/overview` (или отдельным полем).
- **Зачем:** блок C, график «Динамика». Сейчас рисуем `overview.publicIntake.byDay` под честным титулом **«Публичные заявки по дням»** + плашка «Полный тренд по всем источникам — в разработке».
- **Текущее состояние:** `publicIntake.byDay` = только `PUBLIC_QUICK_REQUEST`; тренда по INTERNAL+всем нет.
- **Предлагаемый контракт:**
  ```ts
  type AnalyticsOverviewResponse = {
    // ...
    createdByDay?: Array<{ day: string; total: number }> // ВСЕ источники за период
  }
  ```
- **Приоритет / зона:** `P1` · `S` · `mgmt`.
- **Зависимости:** желательно вместе с P1.2 (общий период from/to).

## P1.5 — `[ФРОНТ]` мобильные обёртки для существующих analytics-эндпоинтов

- **Что нужно:** фронт-обёртки в `api.ts` для уже существующих `GET /analytics/categories`, `/analytics/workload`, `/analytics/specializations`.
- **Зачем:** блок C — эндпоинты **есть на бэке**, но мобилка их не дергает (сейчас категории агрегируются клиентски из `locations`). Отметка для полноты: **это фронт-работа**, backend не трогается.
- **Текущее состояние:** эндпоинты живы (`analytics.controller.ts`, роли ADMIN/MASTER/DISPATCHER/NETWORK_DIRECTOR/PLATFORM_ADMIN), фронт-обёрток нет.
- **Предлагаемый контракт:** обёртки под существующие ответы, без изменений бэка.
- **Приоритет / зона:** `P1` · `S` · `[ФРОНТ]` (mobile-поток сам, не требует management).
- **Зависимости:** нет.

## P1.6 — Видео во вложениях

- **Что нужно:** расширить mime-allowlist на `video/*` + поднять лимит с 25 МБ + storage/preview/стриминг.
- **Зачем:** загрузка видео для заявки и отчёта (запрос из прод-QA; сейчас невозможно).
- **Текущее состояние:** `uploadToTicket` вызывает `assertImageFile` (`ticket-attachments.service.ts:143`) → `ALLOWED_MIME_TYPES` только image (L290-296); контроллер `POST :id/attachments` — лимит 25 МБ, без fileFilter под видео.
- **Предлагаемый контракт:**
  ```ts
  // ALLOWED_MIME_TYPES += ['video/mp4', 'video/quicktime', ...]
  // лимит: конфиг MAX_VIDEO_BYTES (напр. 100–200 МБ), отдельно от фото
  // storage: та же схема TicketAttachment (добавить kind: 'IMAGE' | 'VIDEO'?);
  // preview: постер-кадр / иконка; отдача через protected-blob как сейчас у фото
  ```
- **Приоритет / зона:** `P1` · `L` (storage/стриминг/превью) · `mgmt`.
- **Зависимости:** пересекается с P0.1 (тот же эндпоинт/сервис — согласовать enum+kind вместе).

## P1.7 — attachment↔comment (фото с подписью как одно сообщение)

- **Что нужно:** контракт связи вложения и комментария — чтобы «фото + подпись» было одним сообщением чата (вариант B фото в чате).
- **Зачем:** блок B доп. Ч.2 — реализован **вариант A** (фото и текст — раздельные сообщения). Вариант B (по Figma ChatTab `msg.kind==='photo'` с подписью) отложен: нужен новый backend-контракт.
- **Текущее состояние:** комментарии и фото — **РАЗДЕЛЬНЫЕ** сущности. Comment = `DomainEvent`(`ticket.comment_added`, `payload.comment`) via `POST /tickets/:id/comments {comment}` (DTO только текст). Фото = `TicketAttachment`(+event `ticket.attachment_uploaded`, `payload.attachmentId`) via `POST /tickets/:id/attachments`. Привязки нет.
- **Предлагаемый контракт (варианты на обсуждение):**
  ```ts
  // Вариант 1: TicketAttachment.caption?: string + emit единого события
  //   ticket.attachment_uploaded с payload { attachmentId, caption }
  // Вариант 2: POST /tickets/:id/comments принимает attachmentIds?: string[]
  //   → комментарий с прикреплёнными вложениями (одно сообщение)
  ```
- **Приоритет / зона:** `P1` · `M` · `mgmt`. Зависит от P0.1 (purpose=CHAT, чтобы такие фото не были отчётом).
- **Зависимости:** **P0.1**.

---

# P2 — новые модули (блок D, из прототипа Mobile UX V2 Final)

> Источник: интерактивный прототип `http://localhost:5173` + Master Navigation Map (42 экрана). Все требуют новых доменных моделей — крупные, планировать блоком D.

## P2.1 — Equipment (Оборудование + ТО/ППР)

- **Что нужно:** модель оборудования (QR, статусы, поля) + ТО/ППР + CRUD-endpoints + equipment-health analytics.
- **Зачем:** прототип-экраны Оборудование / Карточка оборудования / ТО и ППР + модалка «Добавить оборудование». Также разблокирует блок C: представление «Оборудование» сейчас показывает счётчики заявок из `context.byEquipment`, но health-статус = «— (нет данных)».
- **Текущее состояние:** сущности оборудования со статусом в API нет; `context.byEquipment` даёт только счётчики заявок на единицу.
- **Предлагаемый контракт:**
  ```prisma
  enum EquipmentStatus { OK MAINTENANCE BROKEN }   // Исправно / ТО / Неисправно
  model Equipment {
    id             String  @id @default(uuid())
    companyId      String
    locationId     String?
    name           String
    category       String?
    manufacturer   String?
    model          String?
    serialNumber   String?
    inventoryNumber String?
    qrCode         String  @unique
    status         EquipmentStatus @default(OK)
    installDate    DateTime?
    warrantyDate   DateTime?
    responsibleId  String?
    lastMaintenance DateTime?
    nextMaintenance DateTime?
  }
  model MaintenanceRecord {          // ТО/ППР
    id String @id @default(uuid())
    equipmentId String
    type String    // ТО / ППР / Диагностика
    plannedAt DateTime?
    doneAt DateTime?
  }
  ```
  ```
  GET/POST/PATCH /equipment ; GET /equipment/:id ; POST /equipment/:id/maintenance
  GET /analytics/equipment-health  → { ok, maintenance, broken, overdueMaintenance }
  ```
- **Приоритет / зона:** `P2` · `L` · `mgmt`.
- **Зависимости:** нет (новый модуль). Даёт health-данные для представления «Оборудование» блока C.

## P2.2 — Receipt / Чеки

- **Что нужно:** модель чека (6 статусов, сумма, привязка к заявке, фото) + endpoints.
- **Зачем:** прототип-вкладка «Чеки» + модалка «Добавить чек».
- **Текущее состояние:** сущности нет.
- **Предлагаемый контракт:**
  ```prisma
  enum ReceiptStatus { DRAFT SUBMITTED REVIEWING CONFIRMED REJECTED PAID }
  // Черновик → Отправлен → Проверяется → Подтверждён / Отклонён / Оплачен
  model Receipt {
    id String @id @default(uuid())
    companyId String
    ticketId String?           // привязка к заявке (опц.)
    amount Decimal             // сумма ₽
    comment String?
    photoAttachmentId String?  // фото чека
    status ReceiptStatus @default(DRAFT)
    createdById String
  }
  ```
  ```
  GET/POST /receipts ; PATCH /receipts/:id (статус-переходы) ; GET /receipts/:id
  ```
- **Приоритет / зона:** `P2` · `L` · `mgmt`.
- **Зависимости:** фото чека — переиспользует TicketAttachment/storage (учесть P0.1/P1.6).

## P2.3 — Task / Planning (Планирование)

- **Что нужно:** модель смен/задач/календаря + endpoints.
- **Зачем:** прототип-экран «Планирование» (5 вкладок: Сегодня/Календарь/Сотрудники/График/История) + «Мой день» + модалка «Добавить задачу». Сейчас в мобилке — карта-заглушка (toast), в live-аналитике «Планирование — нет в API».
- **Текущее состояние:** schedule/calendar endpoints отсутствуют.
- **Предлагаемый контракт:**
  ```prisma
  enum TaskType { PATROL MAINTENANCE PPR CHECK TICKET OTHER }
  model ScheduledTask {
    id String @id @default(uuid())
    companyId String
    assigneeId String?
    type TaskType
    title String
    scheduledAt DateTime
    locationId String?
    ticketId String?
    equipmentId String?
    done Boolean @default(false)
  }
  ```
  ```
  GET /tasks?from&to&assigneeId ; POST /tasks ; PATCH /tasks/:id
  GET /tasks/today  (экран «Мой день»)
  ```
- **Приоритет / зона:** `P2` · `L` · `mgmt`.
- **Зависимости:** ссылается на Equipment (P2.1) для ТО-задач — опционально.

## P2.4 — InspectionTemplate конструктор

- **Что нужно:** расширение шаблонов проверок: дерево разделов→пунктов, 10 типов полей, автозаявка при нарушении + endpoints конструктора.
- **Зачем:** прототип-экраны «Шаблоны проверок» / «Конструктор шаблонов». Сейчас обходы в проде **view-only** (шаблоны создаются в mgmt, мобилка не редактирует).
- **Текущее состояние:** базовые inspection-шаблоны есть (обходы работают на чтение); конструктора с типами полей/автозаявкой нет.
- **Предлагаемый контракт:**
  ```prisma
  model InspectionTemplateSection { id; templateId; title; order }
  model InspectionTemplateItem {
    id; sectionId; title; order
    fieldType String   // 10 типов: yesno, number, text, photo, rating, select, ...
    required Boolean; photoRequired Boolean; photoMin Int
    criticality String // low/med/high
    autoTicket Boolean // автозаявка при нарушении
    autoTicketCategory String?; autoTicketPriority String?
  }
  ```
  ```
  GET/POST/PATCH/DELETE /inspection-templates/:id/sections ; .../items
  ```
- **Приоритет / зона:** `P2` · `L` · `mgmt`.
- **Зависимости:** автозаявка — интеграция с созданием Ticket.

## P2.5 — Акты (PDF по объекту/периоду)

- **Что нужно:** endpoint генерации PDF-акта по объекту/периоду. Может **не требовать** новой модели — агрегация существующих DONE-заявок.
- **Зачем:** прототип-модалка «Акты объекта» (период 7/30/90 → PDF) + «Акт» в действиях заявки.
- **Текущее состояние:** прото-заметка: «Акты: API нет → берём DONE-заявки за период (TODO: /acts endpoint отсутствует)».
- **Предлагаемый контракт:**
  ```
  GET /acts?locationId&from&to           → метаданные акта (список DONE-заявок за период)
  GET /acts/pdf?locationId&from&to       → application/pdf (сгенерированный акт)
  // опц. модель Act (если нужна история/подписи), иначе чистая агрегация
  ```
- **Приоритет / зона:** `P2` · `M` (агрегация) / `L` (если PDF-генерация + модель) · `mgmt`.
- **Зависимости:** нет (использует существующие заявки).

---

# Сводная таблица

| # | Задача | Приоритет | Размер | Зона | Блокирует |
|---|--------|-----------|--------|------|-----------|
| **P0.0** | **🔴 SECURITY: утечка контуров (SECONDARY technician)** | **P0 (security)** | M | mgmt | изоляция данных клиента (утечка в проде) |
| P0.1 | CHAT-purpose вложений | **P0** | S | mgmt + [ФРОНТ] | фото-отчёты (прод), P1.7 |
| P1.1 | `lastRejectedAt` + board | P1 | M | mgmt | карта «Требуют доработки» (E2) |
| P1.2 | overview from/to + дельты | P1 | M | mgmt | дельты KPI, период на overview |
| P1.3 | `/analytics/contractors` | P1 | M–L | mgmt | представление «Подрядчики» |
| P1.4 | полный byDay-тренд | P1 | S | mgmt | график «Динамика» (все источники) |
| P1.5 | обёртки categories/workload/spec | P1 | S | **[ФРОНТ]** | — (фронт сам) |
| P1.6 | видео во вложениях | P1 | L | mgmt | видео заявки/отчёта |
| P1.7 | attachment↔comment | P1 | M | mgmt | фото с подписью (вариант B) |
| P2.1 | Equipment + ТО/ППР | P2 | L | mgmt | Оборудование, health-аналитика |
| P2.2 | Receipt / Чеки | P2 | L | mgmt | вкладка Чеки |
| P2.3 | Task / Planning | P2 | L | mgmt | Планирование, Мой день |
| P2.4 | InspectionTemplate конструктор | P2 | L | mgmt | Конструктор шаблонов |
| P2.5 | Акты (PDF) | P2 | M–L | mgmt | Акты объекта |

---

# Рекомендация по порядку (от mobile-потока)

1. **P0.0 (утечка контуров) — АБСОЛЮТНО первым.** Это **утечка данных** (техник субподрядчика видит весь board клиента) — приоритет выше всего остального. Изолированная точка (`tickets.query.service.ts:258` + узел `companyIds`/локация-скоуп техника), размер M. Чинить до любых фич.

2. **P0.1 (CHAT-purpose) — следующим и срочно.** Единственная задача, которая **тихо портит прод-данные** прямо сейчас (чат-фото засчитываются как отчёт о работе). Размер S, миграция enum + одна ветка в сервисе + 1 строка на фронте. Даёт максимум ценности за минимум усилий и снимает риск накопления «грязных» отчётов.

3. **Пакет P1-аналитика вместе (P1.2 + P1.4, затем P1.3).** P1.2 (from/to + дельты) и P1.4 (полный byDay) трогают один эндпоинт `/analytics/overview` и общий параметр периода — дешевле сделать в одном заходе. Снимают самые заметные «честные пропуски» в готовом блоке C (дельты KPI, полный тренд). P1.3 (подрядчики) — следом, оживляет заглушку-представление. P1.5 (обёртки) mobile-поток закроет сам параллельно, без management.

4. **P1.1 (`lastRejectedAt`) — когда дойдут руки до board.** Не срочно (фронт-костыль через нотификации работает), но убирает хрупкую зависимость от `/notifications` и делает детект O(1). Изолированная задача.

5. **P1.6 (видео) + P1.7 (attachment↔comment) — согласовать с P0.1 как «пакет вложений».** Все три про один эндпоинт/сервис вложений — логично спроектировать enum/kind/caption разом, чтобы не переделывать дважды. P1.6 тяжёлый (storage/стриминг) — можно отложить, но контракт заложить сразу.

6. **P2 (блок D) — отдельным раундом планирования, после закрытия P0/P1.** Пять новых доменных моделей (Equipment, Receipt, Task, TemplateConstructor, Акты) — это уже не «доработка», а новый продуктовый блок. Рекомендуемый порядок внутри D по продуктовой ценности прототипа: **Equipment → Чеки → Планирование → Конструктор шаблонов → Акты** (Equipment первым, т.к. на него завязаны ТО-задачи Планирования и health-аналитика блока C). Мобильные экраны под них уже есть в эталоне `:5173` — фронт готов начинать, как только появятся контракты.

**Итого для немедленного согласования:** **P0.0 (утечка контуров — АБСОЛЮТНО первым)**, затем P0.1 (CHAT-purpose), затем аналитический пакет P1.2/P1.4/P1.3. Остальное — по мере ёмкости management-потока.
