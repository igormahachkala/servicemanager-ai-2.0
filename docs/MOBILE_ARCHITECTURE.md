# MOBILE ARCHITECTURE — Сервис Менеджер

Цель: мобильное приложение для техник-мастеров с офлайн режимом.

---

## Naming standard

- Product/platform: `Сервис Менеджер`.
- Developer brand: `СМА-Тех`.
- Temporary right holder in legal documents: `ИП Ермаков И. А.`.

---

## Primary users
- TECHNICIAN (техник-мастер)

---

## Core use cases (MVP mobile)

- login (JWT)
- list tickets assigned to me
- open ticket details
- change status (IN_PROGRESS, DONE)
- add comment
- attach photos before/after
- create service act (акт выполненных работ)
- client signature

---

## Offline requirements

Offline mode supports:
- viewing last synced tickets
- adding photos/comments/status changes offline
- generating draft act offline

Sync rules:
- store events locally (outbox)
- sync when online
- conflict resolution:
  - server is source of truth
  - if conflict, create “sync error” item for dispatcher review

---

## Mobile data model (local)

Local tables:
- user_session
- tickets_cache
- ticket_events_outbox
- attachments_cache

ticket_events_outbox event types:
- status_changed
- comment_added
- photo_added
- act_generated
- signature_added

---

## Backend API needed (Phase 2)

- GET /tickets?assignedToMe=true
- PATCH /tickets/:id/status
- POST /tickets/:id/comment
- POST /tickets/:id/attachments
- POST /tickets/:id/acts/work-done
- POST /tickets/:id/acts/inspection
- POST /tickets/:id/signature

---

## PDF Acts

Acts types:
1) Inspection act (обход/ТО)
2) Work done act (выполненные работы)

Act generation:
- mobile sends structured JSON
- backend generates PDF
- backend stores PDF link
- optionally returns PDF to mobile

---

## Suggested tech stack (later decision)

Option A:
- Flutter (Android first)
Option B:
- React Native

Offline storage:
- SQLite
- Realm
