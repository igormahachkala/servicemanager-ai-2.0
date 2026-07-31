# Единая acceptance matrix общего обновления — 2026-07-30

Репозиторий: `servicemanager-ai-2.0`

База для изучения: `integration/2026-07-hotfix-bundle-001`

Базовый commit: `36e794a603c78943cfae86471b834433e452df7e`

Режим подготовки: documentation and acceptance planning only.

Документ фиксирует единую матрицу проверки общего обновления, в которое входят:

- HOTFIX-001: creator/assignee identity.
- HOTFIX-002: contractor acceptance.
- HOTFIX-003: access scope and location bindings.
- Assignment candidate integration.
- Subcontractor ticket creation.
- Create+claim.
- Create+assign.
- Full subcontractor lifecycle.
- Subcontractor analytics.
- Desktop.
- Mobile.
- Backend tenant isolation.

## Изученная база

| Область | Фактическая точка проверки |
|---|---|
| Ticket identity | `backend/src/tickets/*`, `backend/src/timeline/*`, `web/src/lib/ticketActorIdentity.ts`, ticket UI/mobile |
| Contractor acceptance | `backend/src/tickets/ticket-acceptance-access.ts`, `tickets.acceptance.service.ts`, ticket meta/actions |
| Location bindings | `backend/src/technicians/technicians.service.ts`, `UserLocationBinding`, `UserAccessScope` |
| Assignment candidates | `backend/src/tickets/tickets.assignment.service.ts`, `secondary-dispatch` tests |
| Create flow | `POST /tickets`, `CreateTicketPage`, `MobileCreateTicket`, draft attachments |
| Lifecycle | claim, assign, comments, attachments, status, acceptance/reject flows |
| Analytics | analytics endpoints, ticket context analytics, desktop/mobile analytics views |
| Tenant isolation | ServiceContract, location scope, equipment/category ownership, direct API negative paths |

## Уровни acceptance

| Уровень | Назначение | Обязательное evidence | Gate |
|---|---|---|---|
| A. Automated regression | Доказать поведение на уровне тестов | команда, результат, SHA, ссылка на лог | До Stage |
| B. Backend API security | Доказать, что прямой API не обходит scope | request, response status, response body summary, fixture summary | До Stage |
| C. Desktop smoke | Проверить основные desktop сценарии | screenshot, route, account, ticket ID | До Stage |
| D. Mobile smoke | Проверить mobile/MAX сценарии | screenshot, viewport, route, account, ticket ID | До Stage |
| E. Stage Product Acceptance | Подтверждение бизнес-сценариев на synthetic Stage данных | заполненные строки матрицы, defects, owner sign-off | До Production |
| F. Production post-deploy smoke | Проверка после production deploy без мутации данных | health checks, read-only smoke, timestamp | После deploy |

## Матрица ролей

| Роль | Компания | Должно быть доступно | Не должно быть доступно |
|---|---|---|---|
| PLATFORM_ADMIN | Platform | Observer/admin проверки по существующим правилам | Непредусмотренная tenant mutation |
| client ADMIN | Client company A/B | Создание, просмотр, приемка своих клиентских заявок; корректная identity | Управление чужими provider/subcontractor сотрудниками |
| provider ADMIN | Primary provider | Управление linked tickets, assignment, access scope, acceptance по policy | Данные foreign client/provider |
| DISPATCHER | Provider | Назначение и управление заявками внутри разрешенного scope | Acceptance или assignment вне scope |
| MASTER | Provider | Create, claim, assign, status, acceptance где разрешено | Acceptance чужой contractor заявки |
| TECHNICIAN | Provider | Create по bindings, claim, comment, photo, status | ALL access при explicit empty scope |
| SECONDARY provider/subcontractor ADMIN | Secondary provider A | Create, assign, analytics своей компании по active SECONDARY scope | PRIMARY analytics или полный client visibility |
| SECONDARY provider/subcontractor MASTER | Secondary provider A | Create, claim, assign, lifecycle, acceptance по creator/assignee policy | Acceptance unrelated contractor ticket |
| SECONDARY provider/subcontractor TECHNICIAN | Secondary provider A | Create+claim и lifecycle только по доступным объектам/оборудованию | Create/read forbidden location/equipment |

## Требования к Stage data

### Компании

| Fixture | Назначение |
|---|---|
| Client company A | Основной positive tenant |
| Client company B | Foreign tenant negative control |
| Primary provider | PRIMARY ServiceContract к Client A |
| Secondary provider/subcontractor A | SECONDARY ServiceContract к Client A |
| Foreign secondary provider B | Negative provider isolation control |

### Contracts

| Contract | Status | Role | Назначение |
|---|---|---|---|
| Client A ↔ Primary provider | ACTIVE | PRIMARY | Positive primary provider scope |
| Client A ↔ Secondary provider A | ACTIVE | SECONDARY | Positive subcontractor scope |
| Client A ↔ Foreign secondary provider B | INACTIVE или absent | SECONDARY/none | Negative access control |
| Client B ↔ any provider | ACTIVE | PRIMARY/SECONDARY | Foreign tenant isolation control |

### Objects, equipment, categories

| Fixture | Company | Назначение |
|---|---|---|
| Allowed location A1 | Client A | Positive location binding |
| Forbidden location A2 | Client A | Negative selected-location test |
| Foreign location B1 | Client B | Cross-tenant negative test |
| Allowed equipment E1 | Client A / A1 | Positive ticket create |
| Equipment E1-A2 | Client A / A2 | Same-client forbidden location test |
| Foreign equipment E2 | Client B / B1 | Direct API negative test |
| Allowed category C1 | Client A | Positive ticket create |
| Foreign category C2 | Client B | Direct API negative test |

### Stage accounts

Использовать только synthetic accounts. Реальные персональные данные сотрудников не использовать.

| Account | Роль | Компания | Назначение |
|---|---|---|---|
| `admin@stage.local` | PLATFORM_ADMIN | Platform | Observer/admin smoke |
| `client@test.local` | client ADMIN или CLIENT | Client A | Customer acceptance |
| `n8n-agent@sma.local` | client ADMIN | Client A | Synthetic client admin |
| `provider@test.local` | ADMIN | Primary provider | Primary provider admin |
| `dispatcher@stage.local` | DISPATCHER | Primary provider | Assignment smoke |
| `master@stage.local` | MASTER | Provider/subcontractor | Master lifecycle/acceptance |
| `stage-tech-*` | TECHNICIAN | Provider/subcontractor | Technician binding/lifecycle |
| `secondary-admin@stage.local` | ADMIN | Secondary provider A | Create+assign and analytics |
| `secondary-master@stage.local` | MASTER | Secondary provider A | Create+claim/acceptance |
| `secondary-tech@stage.local` | TECHNICIAN | Secondary provider A | Create+claim by binding |
| `foreign-secondary-admin@stage.local` | ADMIN | Foreign provider B | Negative isolation |

Если точных аккаунтов нет, Stage agent должен подготовить synthetic equivalents до Product Acceptance.

## Blockers

BLOCKER, если найдено любое из условий:

- Cross-tenant доступ к ticket, location, equipment, category, analytics или assignment candidate.
- Inactive/deleted user может быть назначен, принять, claim или попасть в новые candidates.
- `RESTRICTED_EMPTY` дает любой location access.
- Explicit scope без binding rows трактуется как unrestricted.
- Legacy rows расширяют доступ поверх explicit scope.
- Contractor acceptance проходит для unrelated creator/assignee company.
- SECONDARY provider получает PRIMARY analytics или full client visibility.
- Direct API может создать заявку с forbidden location/equipment/category.

## Mandatory PASS scenarios

До Stage обязательны:

- SCOPE-001...SCOPE-011.
- CREATE-001...CREATE-014.
- LIFE-001...LIFE-012.
- ID-001...ID-009.
- AN-001...AN-011.
- SEC-001...SEC-012.

Optional scenarios отмечены severity `Optional`.

## Acceptance matrix

| ID | блок | роль | предусловия | шаги | ожидаемый результат | backend evidence | desktop | mobile | severity | status | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GIT-001 | Immutable target | Reviewer | Release candidate построен от `36e794a603c78943cfae86471b834433e452df7e` | Зафиксировать branch, HEAD, status, diff scope | Immutable target и clean/dirty state записаны | `git rev-parse HEAD`, `git status`, `git diff --stat` | N/A | N/A | Blocker | Pending | Выполнять в начале и конце review |
| GIT-002 | Diff scope | Reviewer | Release candidate доступен | Проверить diff от base | Только ожидаемые hotfix/subcontractor/docs изменения | `git diff --name-status` | N/A | N/A | Blocker | Pending | Не допускаются env, seeds, migrations без approval, Stage/Production artifacts |
| SCOPE-001 | Access scope | SECONDARY TECHNICIAN | ACTIVE SECONDARY contract; explicit `SELECTED_LOCATIONS`; binding к A1 | Открыть create contexts и board | A1 доступен; A2/B1 недоступны | API response исключает forbidden IDs | A1 виден | A1 виден | Blocker | Pending | Provider-scoped binding |
| SCOPE-002 | Access scope | SECONDARY TECHNICIAN | Explicit `SELECTED_LOCATIONS`; binding rows отсутствуют | Открыть create/board/candidates | Нет location access; fail-close | Empty/403/404 response | Empty state | Empty state | Blocker | Pending | Explicit scope не должен становиться unrestricted |
| SCOPE-003 | Access scope | SECONDARY TECHNICIAN | Explicit `RESTRICTED_EMPTY`; legacy rows существуют | Открыть create/board/candidates | Нет доступа из legacy rows | API показывает restricted empty behavior | No locations | No locations | Blocker | Pending | Legacy не перекрывает explicit |
| SCOPE-004 | Access scope | SECONDARY TECHNICIAN | Legacy client-scoped rows; explicit scope отсутствует | Открыть contexts/read scope | Legacy rows работают только для compatibility | API показывает только legacy-bound locations | Allowed legacy location | Allowed legacy location | Major | Pending | Backward compatibility |
| SCOPE-005 | Access scope | SECONDARY TECHNICIAN | Provider-scoped binding к A1 | Создать заявку по A1 | Создание разрешено | POST `/tickets` 201, `locationId=A1` | Success | Success | Blocker | Pending | Canonical binding path |
| SCOPE-006 | Access scope | SECONDARY TECHNICIAN | Foreign provider binding существует | Открыть contexts/create | Foreign binding игнорируется | API исключает foreign binding | Not visible | Not visible | Blocker | Pending | Binding spoof prevention |
| SCOPE-007 | Access scope | SECONDARY TECHNICIAN | Duplicate bindings | Открыть contexts/candidates | Результат стабильный, без дубликатов | Unique IDs или UI dedupe | No duplicates | No duplicates | Minor | Pending | Data quality regression |
| SCOPE-008 | Access scope | Inactive SECONDARY TECHNICIAN | Valid binding, user inactive | Claim/create/candidate visibility | User заблокирован и не кандидат | 403/excluded | Not assignable | Not assignable | Blocker | Pending | Inactive user |
| SCOPE-009 | Access scope | Deleted SECONDARY TECHNICIAN | Valid binding, user deleted | Claim/create/candidate visibility | User заблокирован и не кандидат | 403/excluded | Not assignable | Not assignable | Blocker | Pending | Deleted user |
| SCOPE-010 | Access scope | Provider ADMIN | Legacy own-company scope | Проверить own provider tickets | Existing own-company behavior сохранен | Baseline-compatible API | No regression | No regression | Major | Pending | ALL_LOCATIONS/legacy own scope |
| SCOPE-011 | Access scope | SECONDARY ADMIN | Explicit scope есть; binding rows отсутствуют | Получить assignment candidates | Empty/fail-close; нет unrestricted fallback | Candidate response empty | No candidate | No candidate | Blocker | Pending | Assignment integration condition |
| CREATE-001 | Create flow | SECONDARY ADMIN | ACTIVE SECONDARY contract; A1/E1/C1 allowed | Desktop full create: объект, оборудование, категория, priority, описание; фото optional по UI | Ticket создан под Client A; creator company = Secondary A | POST 201; DTO/ticket row проверены | Pass | N/A | Blocker | Pending | Desktop create |
| CREATE-002 | Create flow | SECONDARY TECHNICIAN | A1/E1/C1 allowed by binding | Mobile create с фото | Ticket создан и доступен actor | POST 201; IDs соответствуют fixtures | N/A | Pass | Blocker | Pending | Mobile create |
| CREATE-003 | Create flow | SECONDARY TECHNICIAN | A2 forbidden | Direct API create с A2 | Rejected; ticket не создан | 403/404/400; no row | N/A | N/A | Blocker | Pending | Direct API attack |
| CREATE-004 | Create flow | SECONDARY TECHNICIAN | Foreign location B1 | Direct API create с B1 | Rejected; ticket не создан | 403/404/400; no row | N/A | N/A | Blocker | Pending | Cross-tenant location |
| CREATE-005 | Create flow | SECONDARY ADMIN | A1 allowed; E2 foreign | Direct API create с E2 | Rejected | 400/403; no ticket with E2 | N/A | N/A | Blocker | Pending | Foreign equipment |
| CREATE-006 | Create flow | SECONDARY ADMIN | A1 allowed; equipment from A2 | Direct API create с equipment не на выбранном объекте | Rejected | 400/403 | N/A | N/A | Blocker | Pending | Equipment-location consistency |
| CREATE-007 | Create flow | SECONDARY ADMIN | Foreign category C2 | Direct API create с C2 | Rejected | 400/403 | N/A | N/A | Blocker | Pending | Foreign category |
| CREATE-008 | Create flow | SECONDARY ADMIN / SECONDARY TECHNICIAN | A1/E1/C1 allowed | Desktop create без фото; mobile create без фото | Desktop follows optional photo UI; mobile rejects with required photo validation | Desktop 201 or documented optional behavior; mobile validation error without ticket row | Correct validation | Correct validation | Major | Pending | Aligns with V1: mobile requires photo, desktop does not require it |
| CREATE-009 | Create flow | SECONDARY TECHNICIAN | A1/E1/C1 allowed | Create+claim через `postCreateAction=claim_self` | Ticket created and assigned/claimed by same technician in create flow | POST `/tickets` 201; response/timeline shows claimed/assigned creator | Pass | Pass | Blocker | Pending | Atomic create-flow action, not a separate claim API step |
| CREATE-010 | Create flow | SECONDARY ADMIN | Active allowed secondary employee | Create+assign через `postCreateAction=assign_employee` and `assignTechnicianId` | Ticket assigned to employee from Secondary A in create flow | POST `/tickets` 201; assignee company checked | Pass | Pass | Blocker | Pending | Atomic create-flow action, not a separate assign API step |
| CREATE-011 | Create flow | SECONDARY ADMIN | A1/E1/C1 allowed | Create and leave unassigned | Ticket остается unassigned, если процесс разрешает | 201; `assignedTechnicianId=null`; status NEW | Pass | Pass | Major | Pending | Product owner confirmation |
| CREATE-012 | Create flow | SECONDARY ADMIN | Invalid linked client deep link | Открыть URL create с foreign/invalid `linkedClientCompanyId` | UI fail-safe; backend reject при submit | Linked client validation evidence | Error/empty state | Error/empty state | Blocker | Pending | Deep link hardening |
| CREATE-013 | Create flow | Foreign provider ADMIN | Нет active contract к Client A | Direct API create для Client A | Rejected | 403/404; no ticket | N/A | N/A | Blocker | Pending | Foreign provider isolation |
| CREATE-014 | Create flow | SECONDARY TECHNICIAN | Contract inactive/closed | Attempt create on Client A | Rejected | 403/404; no ticket | Error/empty state | Error/empty state | Blocker | Pending | Contract status |
| CREATE-015 | Create flow | PLATFORM_ADMIN | Observer/admin context | Проверить, нет ли случайного tenant create | Existing observer/admin rules сохранены | API policy evidence | No unexpected CTA | N/A | Major | Pending | Regression |
| LIFE-001 | Lifecycle | SECONDARY TECHNICIAN | Ticket NEW, unassigned, A1 allowed | Claim ticket | Claim succeeds only within readable/allowed scope | POST claim 200 | Status/action updated | Status/action updated | Blocker | Pending | Claim |
| LIFE-002 | Lifecycle | SECONDARY ADMIN | Ticket at A1; active allowed employee | Assign ticket | Assignment succeeds; identity correct | Candidates + assign response | Pass | Pass | Blocker | Pending | Assignment |
| LIFE-003 | Lifecycle | SECONDARY TECHNICIAN | Assigned ticket | Start work | Status becomes IN_PROGRESS if transition allowed | Status API 200; timeline event | Pass | Pass | Major | Pending | Start |
| LIFE-004 | Lifecycle | SECONDARY TECHNICIAN | IN_PROGRESS ticket | Add comment | Comment added with correct author; user message not rewritten | POST comment 200; timeline/comment actor | Pass | Pass | Major | Pending | Chat identity regression |
| LIFE-005 | Lifecycle | SECONDARY TECHNICIAN | IN_PROGRESS ticket | Upload photo before | Attachment saved as work evidence | Attachment response; purpose checked | Pass | Pass | Major | Pending | Photo before |
| LIFE-006 | Lifecycle | SECONDARY TECHNICIAN | Work in progress | Upload photo after and add work summary | Evidence complete | Attachment/comment APIs | Pass | Pass | Major | Pending | Photo after |
| LIFE-007 | Lifecycle | SECONDARY TECHNICIAN | Required comment/photo present | Complete/send to acceptance | Ticket moves to AWAITING_ACCEPTANCE where backend maps DONE | Status response; timeline ready event | Pass | Pass | Blocker | Pending | Completion policy |
| LIFE-008 | Lifecycle | SECONDARY MASTER | Awaiting ticket created by or assigned to same contractor company | Contractor acceptance | Allowed only by HOTFIX-002 policy | Acceptance API 200 | Pass | Pass | Blocker | Pending | Contractor acceptance |
| LIFE-009 | Lifecycle | Foreign contractor ADMIN | Unrelated awaiting ticket | Attempt contractor acceptance | Rejected | 403 | Error | Error | Blocker | Pending | Unauthorized acceptance |
| LIFE-010 | Lifecycle | client ADMIN | Awaiting acceptance | Customer final acceptance | Ticket DONE | Acceptance API 200; status DONE | Pass | Pass | Blocker | Pending | Customer acceptance |
| LIFE-011 | Lifecycle | client ADMIN | Awaiting acceptance | Return for correction | Ticket returns to correction state/IN_PROGRESS per workflow | Reject API 200; timeline reason | Pass | Pass | Major | Pending | Return flow |
| LIFE-012 | Lifecycle | SECONDARY TECHNICIAN + client ADMIN | Returned ticket | Re-complete and final accept | Ticket completes after correction | Status + acceptance sequence | Pass | Pass | Major | Pending | Full rework loop |
| ID-001 | Identity | client ADMIN | Client-created ticket | View card/details/timeline | Creator full name, role, company visible | DTO has createdByUser identity only needed fields | Pass | Pass | Major | Pending | HOTFIX-001 |
| ID-002 | Identity | SECONDARY ADMIN | Subcontractor-created ticket | View ticket | Creator company is Secondary A, not Client A | DTO creator company checked | Pass | Pass | Blocker | Pending | No false client fallback |
| ID-003 | Identity | SECONDARY TECHNICIAN | Assigned ticket | View assignment block | Executor full name, role, company visible | DTO assignedTechnician identity | Pass | Pass | Major | Pending | Assignee identity |
| ID-004 | Identity | Reviewer | Company has legalName | View creator/assignee company | `legalName` displayed first | API fixture + screenshot | Pass | Pass | Minor | Pending | legalName fallback |
| ID-005 | Identity | Reviewer | No legalName, brandName exists | View company | `brandName` displayed | API fixture + screenshot | Pass | Pass | Minor | Pending | brandName fallback |
| ID-006 | Identity | Reviewer | Only name exists | View company | `name` displayed | API fixture + screenshot | Pass | Pass | Minor | Pending | name fallback |
| ID-007 | Identity | Reviewer | Creator user exists without company | View ticket | Safe fallback “Организация не указана”; no client substitution | DTO + screenshot | Pass | Pass | Major | Pending | Creator company fallback |
| ID-008 | Identity | Reviewer | Historical inactive assignee remains on old ticket | View ticket/history | Historical assignee displays safely; not available as new candidate | DTO/candidates | Pass | Pass | Major | Pending | Historical inactive display |
| ID-009 | Identity | Reviewer | User lacks full name but has email | View identity | Email only fallback; UUID never shown | Screenshot/API summary | Pass | Pass | Minor | Pending | Safe display fallback |
| AN-001 | Analytics | SECONDARY ADMIN | Tickets created by Secondary A in period | Open analytics with period | Created count matches scoped tickets | Analytics response + fixture count | Pass | Pass | Major | Pending | Created |
| AN-002 | Analytics | SECONDARY ADMIN | Tickets assigned to Secondary A employees | Open analytics | Assigned count matches provider users only | API response | Pass | Pass | Major | Pending | Assigned |
| AN-003 | Analytics | SECONDARY MASTER | Tickets IN_PROGRESS | Filter period/location | In-progress count correct | API response | Pass | Pass | Major | Pending | In progress |
| AN-004 | Analytics | SECONDARY ADMIN | Completed tickets exist | Filter period | Completed count correct | API response | Pass | Pass | Major | Pending | Completed |
| AN-005 | Analytics | SECONDARY ADMIN | Overdue/SLA fixtures | Open SLA widgets | SLA, overdue, response time, completion time scoped | API response with fixture math | Pass | Pass | Major | Pending | SLA/time metrics |
| AN-006 | Analytics | SECONDARY ADMIN | Returned tickets exist | Filter returned | Returned count scoped | API response | Pass | Pass | Major | Pending | Returned |
| AN-007 | Analytics | SECONDARY ADMIN | Tickets by A1 and forbidden A2 | Open by location | A1 included; forbidden A2 excluded | API excludes A2 | Pass | Pass | Blocker | Pending | Forbidden location exclusion |
| AN-008 | Analytics | SECONDARY ADMIN | Category/priority fixtures | Open by category/priority | Buckets match scoped data only | API response | Pass | Pass | Major | Pending | Category/priority |
| AN-009 | Analytics | SECONDARY ADMIN | Employee workload fixtures | Open by employee | Only Secondary A employees shown | API excludes foreign users | Pass | Pass | Blocker | Pending | Employee tenant isolation |
| AN-010 | Analytics | Foreign provider ADMIN | No Client A access | Request Client A analytics | Rejected or empty scoped response; no leak | 403/404 or empty permitted response | Error/empty | Error/empty | Blocker | Pending | Foreign tenant exclusion |
| AN-011 | Analytics | SECONDARY ADMIN | No scoped tickets in period | Open analytics | Zero-state without crash | API 200 zero metrics | Pass | Pass | Minor | Pending | Zero-state |
| AN-012 | Analytics | SECONDARY ADMIN | Planned/emergency fixtures exist | Open planned/emergency split | Correct if model supports it; otherwise roadmap | API evidence or N/A | Pass/N/A | Pass/N/A | Optional | Pending | Depends on current data model |
| SEC-001 | API security | SECONDARY ADMIN | Knows foreign Client B IDs | POST create with Client B IDs | Rejected | HTTP 403/404/400; no row | N/A | N/A | Blocker | Pending | Direct API attack |
| SEC-002 | API security | SECONDARY ADMIN | Knows foreign equipment ID | POST create with E2 | Rejected | HTTP 403/400; no row | N/A | N/A | Blocker | Pending | Equipment leak prevention |
| SEC-003 | API security | SECONDARY ADMIN | Knows foreign category ID | POST create with C2 | Rejected | HTTP 403/400 | N/A | N/A | Blocker | Pending | Category leak prevention |
| SEC-004 | API security | SECONDARY ADMIN | Inactive contract | GET board/create contexts/analytics | Rejected or empty | HTTP evidence | N/A | N/A | Blocker | Pending | Contract status |
| SEC-005 | API security | Inactive TECHNICIAN | Existing test session/fixture | Attempt create/claim/candidate visibility | Blocked/excluded | HTTP 403/excluded | N/A | N/A | Blocker | Pending | Inactive access |
| SEC-006 | API security | Deleted TECHNICIAN | Deleted fixture | Attempt operations | Blocked/excluded | HTTP 403/excluded | N/A | N/A | Blocker | Pending | Deleted access |
| SEC-007 | API security | SECONDARY ADMIN | Explicit `RESTRICTED_EMPTY` + legacy rows | GET candidates | Empty/fail-close | Candidate response empty | N/A | N/A | Blocker | Pending | Assignment integration condition |
| SEC-008 | API security | SECONDARY ADMIN | `SELECTED_LOCATIONS` A1; broader legacy rows A1/A2 | GET candidates/create contexts | A1 only | API excludes A2 | N/A | N/A | Blocker | Pending | Explicit overrides legacy |
| SEC-009 | API security | SECONDARY ADMIN | Duplicate bindings | GET candidates/create contexts | Stable deduped result | API/UI no duplicate user/location | N/A | N/A | Major | Pending | Data quality |
| SEC-010 | API security | Foreign provider ADMIN | Active contract to Client B only | GET Client A board/analytics/candidates | Rejected/no data | HTTP evidence | N/A | N/A | Blocker | Pending | Foreign provider |
| SEC-011 | API security | SECONDARY MASTER | Ticket unreadable by scope | Direct accept/status/comment | Rejected | HTTP 403/404 | N/A | N/A | Blocker | Pending | Readability prerequisite |
| SEC-012 | API security | SECONDARY ADMIN | User from foreign provider passed to assign API | Direct assign foreign user | Rejected; ticket assignee unchanged | HTTP 403/400; DB unchanged | N/A | N/A | Blocker | Pending | Candidate bypass prevention |
| DESK-001 | Desktop smoke | SECONDARY ADMIN | Valid context | Open board, create, ticket detail | No layout overlap; create and identity visible | API smoke + screenshot refs | 1440/1024 pass | N/A | Major | Pending | Desktop shell |
| DESK-002 | Desktop smoke | client ADMIN | Awaiting ticket | Accept/return workflow | Actions match backend permissions | API + screenshot refs | Pass | N/A | Major | Pending | Customer acceptance |
| DESK-003 | Desktop smoke | provider ADMIN | Assignment modal | Candidate list shows legal entity, full name, role | Candidates API + screenshot | Pass | N/A | Major | Pending | HOTFIX-001 + assignment |
| MOB-001 | Mobile smoke | SECONDARY TECHNICIAN | Allowed bound location | Create+claim on `/m/create` or `/max/create` | Ticket created/claimed; no overflow | API + screenshot refs | N/A | 390/360 pass | Blocker | Pending | Mobile create+claim |
| MOB-002 | Mobile smoke | SECONDARY ADMIN | Assignment modal available | Assign allowed employee | Assignment succeeds; identity visible | API + screenshot refs | N/A | Pass | Major | Pending | Mobile assignment |
| MOB-003 | Mobile smoke | SECONDARY TECHNICIAN | Assigned ticket | Comment/photo/status lifecycle | Full work cycle works | API + screenshot refs | N/A | Pass | Major | Pending | Mobile lifecycle |
| PROD-001 | Production post-deploy smoke | Operator | Production deploy complete | Health checks, login, read-only board/ticket route | No errors; no data mutation | Health/status logs | Pass | Pass | Blocker | Pending | No real data changes |

## Матрица scope

| Scope scenario | Expected decision | Mandatory rows |
|---|---|---|
| ALL/legacy own-company scope | Preserve existing own-company behavior | SCOPE-010 |
| SELECTED_LOCATIONS with binding | Allow only bound location IDs | SCOPE-001, SCOPE-005 |
| SELECTED_LOCATIONS without binding | Fail-close | SCOPE-002, SCOPE-011 |
| RESTRICTED_EMPTY | No location/ticket/candidate access | SCOPE-003, SEC-007 |
| Legacy rows without explicit scope | Compatibility only | SCOPE-004 |
| Foreign provider binding | Ignored | SCOPE-006 |
| Duplicate binding | Deduped/stable | SCOPE-007, SEC-009 |
| Inactive/deleted user | Excluded from new operations | SCOPE-008, SCOPE-009, SEC-005, SEC-006 |

## Матрица create flow

| Create scenario | Expected decision | Mandatory rows |
|---|---|---|
| Desktop create | Allowed only within active service/scope | CREATE-001 |
| Mobile create | Allowed only within active service/scope | CREATE-002 |
| Allowed location/equipment/category | 201 and correct tenant ownership | CREATE-001, CREATE-002 |
| Forbidden location | Reject | CREATE-003, CREATE-004 |
| Forbidden equipment | Reject | CREATE-005, CREATE-006 |
| Forbidden category | Reject | CREATE-007 |
| Photo | Stored as allowed request evidence | CREATE-001, CREATE-002 |
| Without photo | Desktop optional; mobile must reject because photo is required | CREATE-008 |
| Leave unassigned | Allowed only if process allows | CREATE-011 |
| Create+claim | Atomic create flow with `postCreateAction=claim_self` by same valid executor | CREATE-009 |
| Create+assign | Atomic create flow with `postCreateAction=assign_employee` and allowed employee | CREATE-010 |
| Invalid deep link | UI fail-safe, backend reject | CREATE-012 |
| Direct API attack attempt | Reject without DB mutation | CREATE-003...CREATE-007, SEC-001...SEC-003 |

## Матрица lifecycle

| Lifecycle step | Expected decision | Mandatory rows |
|---|---|---|
| Create | Ticket owned by client company, creator identity from actor company | CREATE-001, ID-002 |
| Claim | Allowed only by readable/allowed executor | LIFE-001 |
| Assign | Candidate must be active, scoped, same allowed provider/subcontractor | LIFE-002, SEC-012 |
| Start | Status transition allowed by backend workflow | LIFE-003 |
| Comment | Author remains actual message author | LIFE-004 |
| Photo before/after | Attachment accepted only in allowed ticket scope | LIFE-005, LIFE-006 |
| Complete/send to acceptance | Backend acceptance state reached | LIFE-007 |
| Contractor acceptance | Only creator/assignee contractor policy allows | LIFE-008, LIFE-009 |
| Customer acceptance | Client final acceptance works | LIFE-010 |
| Return/re-complete | Correction loop works | LIFE-011, LIFE-012 |

## Матрица analytics

| Analytics scenario | Expected decision | Mandatory rows |
|---|---|---|
| Created | Count scoped by subcontractor/company/period | AN-001 |
| Assigned | Assigned to own employees only | AN-002 |
| In progress | Status bucket scoped | AN-003 |
| Completed | Status bucket scoped | AN-004 |
| Overdue/SLA/response/completion time | Calculated only from scoped tickets | AN-005 |
| Returned | Returned/rework bucket scoped | AN-006 |
| By location | Forbidden locations excluded | AN-007 |
| By employee | Foreign employees excluded | AN-009 |
| By category/priority | Buckets scoped | AN-008 |
| Period filter | All counts respect selected period | AN-001...AN-011 |
| Zero-state | No crash, no false data | AN-011 |
| Planned/emergency | Optional unless current data model supports it | AN-012 |

## Regression risks

| Risk | Impact | Required mitigation |
|---|---|---|
| SECONDARY scope becomes PRIMARY-like | Cross-tenant/client leak | Backend direct API and analytics exclusion tests |
| Explicit scope ignored when legacy rows exist | Forbidden location access | `RESTRICTED_EMPTY` and `SELECTED_LOCATIONS` precedence tests |
| Equipment endpoint remains company-local only | Subcontractor create cannot select equipment | API + desktop/mobile create smoke |
| Invalid linked-client deep link is accepted | API attack surface | UI fail-safe and backend rejection |
| Assignment candidates use old binding semantics | Candidate outside provider/location scope | SEC-007, SEC-008, SEC-012 |
| Identity fallback substitutes client company | Incorrect legal identity | ID-002, ID-007 |
| Analytics reuses PRIMARY provider overview | Subcontractor sees too much | AN-009, AN-010 |
| Inactive/deleted users remain assignable | Unauthorized work assignment | SCOPE-008, SCOPE-009, SEC-005, SEC-006 |
| Mobile diverges from desktop | Field workflow failure | MOB-001...MOB-003 plus desktop parity |

## Evidence template

### Backend evidence

- Test ID.
- Timestamp.
- Account and role.
- Company and contract fixture.
- Location, equipment, category IDs.
- Ticket ID if created.
- Request method/path.
- Request body summary without secrets.
- Response status.
- Response body summary.
- DB fixture summary if used.
- Expected result.
- Actual result.
- PASS/FAIL.
- Defect ID and severity if failed.

### UI evidence

- Test ID.
- Timestamp.
- Account and role.
- Browser/device viewport.
- Route.
- Ticket ID if applicable.
- Screenshot reference.
- Expected visible state.
- Actual visible state.
- PASS/FAIL.
- Defect ID and severity if failed.

## Stage acceptance execution order

1. Validate immutable release candidate SHA and clean branch.
2. Prepare synthetic users, companies, contracts, locations, equipment, categories, bindings.
3. Run automated regression suite.
4. Run backend API security matrix.
5. Run desktop smoke.
6. Run mobile/MAX smoke.
7. Run Stage Product Acceptance with synthetic users only.
8. Record blocker/major/minor findings.
9. Proceed to Production only if GO criteria are met.

## GO / NO-GO criteria

GO to Stage only if:

- Immutable integration/release candidate exists.
- Independent integration review is PASS or PASS WITH documented non-blocking integration condition closed.
- Assignment candidate integration condition is closed.
- Backend tests pass.
- Frontend build passes.
- Blocker findings = 0.
- No unresolved major security findings.
- Branch is clean.
- Local/remote SHA match if branch is published.

GO to Production only if:

- Stage deploy succeeded.
- Migrations are absent or separately approved.
- Stage Product Acceptance is PASS.
- Blocker findings = 0.
- Major findings = 0 or explicitly accepted by Owner.
- Rollback plan is confirmed.
- Production backup is confirmed.
- Production post-deploy smoke plan is ready.

## Optional / roadmap scenarios

- Formal provider-to-provider `SubcontractorContract` hierarchy.
- Advanced recurring fault detection.
- Problem equipment trend model beyond current ticket/equipment relations.
- Export routes for subcontractor analytics.
- Forecast workload/capacity planning.
- Maintenance checklists, materials, and cost tracking.
- Planned vs emergency classification if not represented in the current ticket model.

## Final checklist

- All Mandatory PASS rows have evidence.
- Every blocker scenario has explicit PASS evidence.
- Every failed row has a defect ID.
- Stage data uses synthetic accounts only.
- Real employee personal data is not used.
- Stage/Production data is not mutated outside planned acceptance steps.
- Production code was not changed by this documentation task.
