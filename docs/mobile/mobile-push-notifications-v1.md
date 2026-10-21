# Purpose

Document the Mobile Push Notifications V1 architecture for ServiceManager.AI.

The goal of V1 is to extend the existing in-app notification system to mobile PWA push notifications without changing ticket workflow behavior. Push delivery must reuse the current notification source of truth, preserve tenant isolation, and remain optional per user/device.

# Current Architecture

ServiceManager.AI already has in-app notifications for ticket lifecycle events.

The current backend creates `Notification` rows when ticket services emit notification actions. These rows are scoped by `companyId` and `userId`, have a string `type`, target an `entityType` and `entityId`, and use a unique `dedupeKey` to suppress duplicate rows for the same recipient/event. Notification reads are exposed through JWT-protected REST endpoints under `/notifications`.

Realtime behavior is handled separately by the custom `/ws` service. The realtime service authenticates WebSocket clients with JWT, supports board and notifications subscriptions, polls `DomainEvent` and `Notification` rows, and sends invalidation messages to connected clients. For notifications, it only broadcasts to the matching `(companyId, userId)` client session.

The frontend consumes this through `useWsInvalidation`, invalidates React Query caches, refreshes `mobile-notifications`, and calls `useRealtimeNotifications` to show an in-app toast. If the user enabled browser notifications and the browser permission is already granted, the frontend also creates a system notification using the browser `Notification` constructor.

The mobile PWA has a manifest and mobile routes under `/m`, including a notifications page and profile/settings entry for browser notifications. It does not currently register a Service Worker, does not persist Push API subscriptions, and cannot deliver notifications when the app is closed.

# Existing Components

- Notification entity
  - Persisted `Notification` table.
  - Fields include `companyId`, `userId`, `type`, `title`, `message`, `entityType`, `entityId`, optional `linkedClientCompanyId`, `readAt`, `createdAt`, and unique `dedupeKey`.
  - Indexed by `(userId, companyId, readAt)` and `(userId, companyId, createdAt)`.

- NotificationService
  - Creates in-app notifications for ticket creation, assignment, claim, comments, attachments, status changes, acceptance requested, acceptance accepted, and acceptance rejected.
  - Resolves recipients from company, role, assignment, location bindings, service contracts, and actor exclusion rules.
  - Uses `dedupeKey` with `createMany skipDuplicates` or unique-violation handling.
  - Also sends selected ticket events to MAX bot, which is separate from mobile push.

- WebSocket realtime
  - Custom `/ws` implementation in the backend.
  - Authenticates with JWT and verifies active user membership in the JWT company.
  - Supports `board` and `notifications` subscriptions.
  - Polls recent `DomainEvent` and `Notification` rows.
  - Sends `notifications.invalidate` only to connected clients whose `companyId` and `userId` match the notification row.

- Browser notifications
  - Optional frontend-only feature.
  - Stores the app-level enable flag in local storage.
  - Uses the browser `Notification` API while the app tab/session is open.
  - Does not use Push API, Service Worker push events, or backend delivery.

- Mobile PWA
  - `/m` route tree provides mobile home, tickets, notifications, profile, offline queue, analytics, chats, and inspection flows.
  - Mobile shell fetches `mobile-notifications` and shows unread badge counts.
  - Mobile notifications page lists current in-app notifications and supports mark-one-read and mark-all-read.
  - Offline queue exists for ticket actions, but not for notification subscription management.

- Manifest
  - `web/public/manifest.json` defines `name`, `short_name`, `start_url` as `/m`, `display` as `standalone`, theme/background colors, and 192/512 icons.
  - The manifest is linked from `web/index.html`.

- Current limitations
  - No Service Worker registration.
  - No Push API subscription flow.
  - No backend push module.
  - No push subscription storage.
  - No VAPID keys or public-key endpoint.
  - No push delivery retry state.
  - Browser/system notifications only work while the app is open and connected.
  - Push preferences are local-only for browser notifications and are not stored per tenant/user/device.
  - Existing notification payloads are enough for in-app navigation but need a stable push-safe payload contract.

# Proposed Architecture

Frontend:

- Add a mobile-first push permission and subscription flow from profile/settings and optionally from the notifications page.
- Keep in-app notifications as the canonical user inbox.
- Register a Service Worker on supported secure origins.
- Request notification permission only after a user action.
- Subscribe the browser through `PushManager` using the backend-provided VAPID public key.
- Send the resulting subscription to the backend with the current JWT.
- Keep current WebSocket realtime behavior for open sessions.
- Fall back to in-app notifications and WebSocket/browser notifications when Push API is unsupported or permission is denied.

Service Worker:

- Own push event handling while the PWA is backgrounded or closed.
- Parse a compact push payload containing notification id, type, title, body, entity target, tenant scope hint, and click URL.
- Display a system notification with stable tag/dedupe data.
- On notification click, open or focus the PWA at the target screen.
- Use `/m/tickets/:id` for ticket targets and preserve `linkedClientCompanyId` when required.
- Avoid embedding secrets, JWTs, personal tokens, or large ticket content in push payloads.

Backend Push Module:

- Add a dedicated push module beside the existing notifications module.
- Keep `NotificationService` responsible for deciding recipients and creating `Notification` rows.
- Add a delivery layer that observes newly created notification rows and sends push messages to active subscriptions for the target `(companyId, userId)`.
- Expose endpoints for VAPID public key lookup, subscription upsert, subscription disable/delete, and per-user notification settings.
- Do not make push delivery a dependency for ticket mutations. Ticket operations must succeed even if push delivery fails.

Push Subscription storage:

- Persist one row per browser/device subscription.
- Scope every row by `companyId` and `userId`.
- Store endpoint and keys in a way that supports endpoint uniqueness and safe lookup.
- Track device label, user agent, platform, last seen, revoked/disabled state, and failure counters.
- Delete or disable subscriptions when the browser reports an expired or gone endpoint.

VAPID:

- Store VAPID public/private keys in environment-specific secret management.
- Expose only the public key to authenticated frontend clients.
- Use the private key only inside the backend push delivery service.
- Include a stable contact subject owned by ServiceManager.AI operations.
- Plan key rotation as a controlled production operation because old subscriptions may need renewal.

Delivery flow:

1. Ticket workflow creates timeline/domain events and calls `NotificationService`.
2. `NotificationService` creates deduped `Notification` rows for resolved recipients.
3. Realtime WebSocket keeps current open-session behavior by broadcasting invalidations.
4. Push delivery selects active subscriptions for the notification row's `(companyId, userId)`.
5. Backend sends a compact Web Push payload to each subscription.
6. Service Worker displays the notification.
7. Notification click opens the target mobile screen.
8. Opening the target screen marks the notification read through the existing REST endpoint when appropriate.

Retry strategy:

- Treat HTTP 404 and 410 from push providers as terminal and disable the subscription.
- Treat transient provider/network errors as retryable.
- Track delivery attempts per notification/subscription pair.
- Use exponential backoff with a bounded retry count.
- Keep retries asynchronous from ticket writes.
- Add observability for sent, failed, expired, skipped, and retried deliveries.
- Do not retry indefinitely after the underlying notification is read or the subscription is disabled.

Tenant isolation:

- Every subscription, preference, delivery attempt, and notification remains scoped by `companyId` and `userId`.
- Subscription upsert must derive `companyId` and `userId` from JWT, never from client-submitted body fields.
- Push delivery must join by notification row scope and subscription row scope.
- Provider linked-client navigation may include `linkedClientCompanyId`, but the notification remains owned by the provider user's company.
- Platform observer mode must not create cross-tenant push delivery unless the notification row is explicitly created for that platform user.

# Database Changes

Required Prisma models:

| Model | Purpose | Required data |
| --- | --- | --- |
| PushSubscription | Stores one active or disabled Web Push subscription per user/device/browser endpoint. | `id`, `companyId`, `userId`, endpoint identifier, endpoint hash, public key material, auth secret, user agent, platform/device metadata, `enabled`, failure counters, `lastSeenAt`, `revokedAt`, timestamps. |
| NotificationDelivery | Tracks push delivery attempts for one notification and one push subscription. | `id`, `companyId`, `userId`, `notificationId`, `pushSubscriptionId`, status, attempt count, next retry time, provider status code, last error class/message, sent time, failed time, timestamps. |
| NotificationPreference | Stores server-side user preferences for push event classes. | `id`, `companyId`, `userId`, event type or event group, channel, enabled flag, quiet-hours fields if V1 includes them, timestamps. |

Required relations and indexes:

- `PushSubscription.companyId` references `Company`.
- `PushSubscription.userId` references `User`.
- `NotificationDelivery.notificationId` references `Notification`.
- `NotificationDelivery.pushSubscriptionId` references `PushSubscription`.
- Unique endpoint hash to prevent duplicate browser subscriptions.
- Index active subscriptions by `(companyId, userId, enabled)`.
- Index delivery retries by `(status, nextAttemptAt)`.
- Index deliveries by `(notificationId, pushSubscriptionId)` to prevent duplicate delivery jobs for the same subscription.

No existing `Notification` fields need to be removed. V1 may add optional metadata only if the push payload cannot be derived from the existing notification row and ticket target.

# Backend Changes

Add a push module with these responsibilities:

- VAPID configuration provider
  - Loads public/private VAPID keys from environment/secret manager.
  - Validates required configuration at startup in environments where push is enabled.

- Push subscription controller
  - Returns the VAPID public key.
  - Upserts the current user's subscription.
  - Lists current user's registered devices if needed for settings.
  - Disables/removes a subscription for the current user.
  - Does not accept client-supplied tenant ownership.

- Push subscription service
  - Normalizes endpoint data.
  - Computes endpoint hash.
  - Stores keys and metadata.
  - Marks subscriptions disabled on logout request or terminal delivery errors.

- Push delivery service
  - Accepts newly created notification ids or polls unsent notification rows.
  - Resolves active subscriptions for the exact notification recipient.
  - Builds a push-safe payload.
  - Sends Web Push using VAPID.
  - Records delivery attempts and retry state.

- Push retry worker
  - Processes retryable `NotificationDelivery` rows.
  - Applies bounded exponential backoff.
  - Disables expired subscriptions.
  - Emits logs/metrics for operational visibility.

- Notification integration
  - Keep `NotificationService` as the source of notification creation and dedupe.
  - After successful notification creation, enqueue push delivery asynchronously.
  - For `createMany`, enqueue deliveries for created notifications through a query by dedupe keys or through an outbox-style delivery scanner.

# Frontend Changes

Permission flow:

- Show an explicit user-controlled setting in mobile profile/settings.
- Explain status with short labels: unsupported, not requested, enabled, blocked, disabled.
- Request `Notification` permission only from a direct user action.
- Do not repeatedly prompt after denial.
- On iPhone, only offer push enrollment when the app is installed as a PWA and the platform supports Web Push.

Subscription flow:

- Fetch VAPID public key from the backend after login.
- Register the Service Worker.
- Subscribe with `PushManager`.
- Send subscription JSON and device metadata to the backend with JWT.
- On app launch, reconcile the local subscription with the backend if permission is granted.
- Re-subscribe when the browser rotates subscription keys or the VAPID public key changes.

Service Worker:

- Handle `push` events and display notifications.
- Handle `notificationclick` events and route to the target mobile screen.
- Use notification `tag` or data for dedupe.
- Keep payload handling defensive; unknown payloads open `/m/notifications`.
- Avoid relying on React runtime state because the Service Worker runs outside the app.

Notification settings:

- Store server-side preferences by user and tenant.
- Start V1 with channel-level enable/disable and event-group toggles.
- Keep existing in-app notification inbox always available.
- Treat local browser permission and server preference as separate gates.

Fallback behavior:

- If Push API is unsupported, keep the current mobile notification inbox and WebSocket realtime.
- If permission is denied, do not show native push but continue in-app notifications.
- If Service Worker registration fails, show in-app state and log a frontend diagnostic.
- If backend push config is disabled in a non-production environment, hide enrollment or show disabled state.

# Event Matrix

| Event | Recipient | Payload | Target screen | Dedupe |
| --- | --- | --- | --- | --- |
| new ticket | Client company operational watchers; primary provider operational users when service-contract scope applies; creator confirmation when applicable. | `notificationId`, `ticket.created`, ticket id, ticket number, title/message, optional `linkedClientCompanyId`, urgency flag when available. | `/m/tickets/:ticketId`; fallback `/m/notifications`. | Existing notification `dedupeKey` using event or ticket id plus recipient company/user; push delivery unique by notification/subscription. |
| assigned | Assigned technician; client company operational watchers when a provider technician is assigned. | `notificationId`, `ticket.assigned`, ticket id, ticket number, assignment mode/title/message, optional `linkedClientCompanyId`. | `/m/tickets/:ticketId`. | Existing assignment dedupe by event/ticket, company, user, and assignment mode where relevant. |
| comment | Watchers except actor/assignee where applicable; assigned technician when different from actor. | `notificationId`, `ticket.comment_added`, ticket id, ticket number, clipped comment/summary, optional `linkedClientCompanyId`. | `/m/tickets/:ticketId`, ideally focused to chat/timeline section when the screen supports it. | Existing comment dedupe by source event or ticket id plus recipient scope; push delivery unique by notification/subscription. |
| attachment | Watchers except actor/assignee where applicable; assigned technician when different from actor. | `notificationId`, `ticket.attachment_uploaded`, ticket id, ticket number, title/message, optional `linkedClientCompanyId`, attachment indicator without private file URL. | `/m/tickets/:ticketId`, ideally attachment/photo section. | Existing attachment dedupe by source event or ticket id plus recipient scope; push delivery unique by notification/subscription. |
| status changed | Assigned technician when another actor changes status; client company operational users for key client-visible states. | `notificationId`, `ticket.status_changed` or state-specific type, ticket id, ticket number, from/to status label, optional `linkedClientCompanyId`. | `/m/tickets/:ticketId`. | Existing status dedupe includes source event or ticket id, recipient, and from/to status. |
| SLA | Operational watchers for the ticket company and assigned technician if business rules enable direct assignee SLA push. | `notificationId`, `sla.warning` or `sla.overdue`, ticket id, ticket number, due/breach state, no sensitive payload. | `/m/tickets/:ticketId`; analytics users may also navigate to `/m/analytics`. | Use SLA domain event id plus recipient; one warning per ticket window and one breach per ticket. |
| acceptance requested | Client acceptance roles in the ticket company. | `notificationId`, `ticket.awaiting_acceptance`, ticket id, ticket number, title/message. | `/m/tickets/:ticketId`, acceptance/review action area. | Existing awaiting-acceptance dedupe by ready-for-acceptance event or ticket id plus recipient. |
| acceptance rejected | Assigned technician when client rejects work. | `notificationId`, `ticket.rejected`, ticket id, ticket number, clipped rejection comment when present, optional `linkedClientCompanyId`. | `/m/tickets/:ticketId`, work report/comment area. | Existing rejected dedupe by acceptance event or ticket id plus technician recipient. |
| urgent ticket | Same recipients as new ticket, with urgency-highlighted payload and priority label. | `notificationId`, `urgent.created` or `ticket.created` with urgent flag, ticket id, ticket number, short summary, optional `linkedClientCompanyId`. | `/m/tickets/:ticketId`. | Prefer one notification row per urgent ticket recipient; dedupe by ticket-created event plus recipient, not a second duplicate urgent row unless product requires a separate urgent channel. |

# UX

The user flow starts after login in the mobile PWA.

1. User opens Profile or Notifications settings.
2. App shows current push state: unsupported, available, blocked, enabled, or disabled.
3. User taps enable.
4. App requests browser notification permission.
5. If granted, app registers the Service Worker and creates a Push API subscription.
6. App sends the subscription to the backend.
7. Backend stores the subscription under the current JWT user and company.
8. UI confirms push is enabled for this device.
9. When a relevant ticket event occurs, the in-app notification is created and push delivery runs asynchronously.
10. The device receives a system notification even when the PWA is backgrounded or closed.
11. User taps the notification.
12. Service Worker opens the target ticket screen or focuses the existing PWA window.
13. The app fetches fresh ticket and notification data.
14. If the notification is still unread, the app marks it read through the existing endpoint.

Disable flow:

1. User opens push settings.
2. User disables push for this device.
3. Frontend unsubscribes where supported and tells the backend to disable the subscription.
4. Existing in-app notifications remain unaffected.

Logout flow:

1. User logs out from the PWA.
2. App clears JWT/session state.
3. App calls best-effort subscription disable before clearing auth where possible.
4. If disable cannot complete, backend ownership checks and eventual terminal failures still prevent cross-user data exposure.

# Security

Tenant isolation:

- Push subscriptions are tenant/user-owned records.
- Backend derives `companyId` and `userId` from JWT.
- Delivery selects subscriptions only for the notification row's exact recipient scope.
- `linkedClientCompanyId` is only a navigation hint and must not override ownership.

JWT:

- Subscription create/update/delete endpoints require `JwtAuthGuard`.
- JWT is used only to authenticate the subscription management request.
- JWT must not be stored in the Service Worker payload or push notification data.
- Notification click opens the app; normal app auth determines whether the user can view the target.

Subscription ownership:

- Users can only create, list, disable, or delete their own subscriptions in their JWT company.
- Endpoint uniqueness must not allow one user to steal another user's subscription.
- Reusing an endpoint after login as a different user should reassign only through an authenticated upsert and should disable the previous active ownership safely.

Logout behavior:

- Frontend should best-effort unsubscribe/disable the current device subscription on logout.
- Backend should expose a current-device disable endpoint.
- A global logout/session revocation design should disable all subscriptions for that session or user when that feature exists.
- Even if logout cleanup fails, push payloads must be minimal and must not include private ticket details.

Privacy:

- Push payloads should contain only short notification text and routing metadata.
- Do not include phone numbers, full requester details, attachment URLs, JWTs, or internal policy details.
- Keep sensitive details behind authenticated app screens.
- Store endpoint and key material with care; endpoint hashes should be used for uniqueness and lookup where possible.

# Test Plan

Stage:

- Validate VAPID configuration is present only where push is enabled.
- Verify subscription upsert, duplicate endpoint handling, disable, and retry records.
- Create each supported notification event and confirm one in-app row plus expected push delivery attempts.
- Confirm WebSocket realtime behavior still works unchanged for open sessions.
- Verify terminal provider responses disable subscriptions.
- Verify tenant isolation with two companies and two users on the same stage environment.
- Verify provider linked-client notifications open with the correct `linkedClientCompanyId`.

Production:

- Roll out behind a feature flag.
- Enable for internal/admin users first.
- Monitor push send count, delivery failures, expired subscriptions, retry depth, and ticket operation latency.
- Confirm no ticket mutation depends on push provider availability.
- Validate secret loading and VAPID key backup/rotation procedure.
- Confirm privacy review of push title/body text before broad enablement.

iPhone:

- Test on supported iOS/Safari versions with the PWA installed to Home Screen.
- Confirm enrollment is hidden or explains unsupported state when not installed or unsupported.
- Verify permission prompt appears only after user action.
- Verify background delivery, tap-to-open, and target routing to `/m/tickets/:id`.
- Verify blocked permission recovery instructions.
- Verify logout disables or prevents useful push delivery for the old session.

Android:

- Test Chrome and the installed PWA flow.
- Verify Service Worker registration, Push API subscription, background delivery, notification click routing, and notification tag dedupe.
- Verify behavior across app updates and browser subscription rotation.
- Verify battery/background restrictions do not break the expected fallback to in-app notifications.

# Rollout Plan

1. Documentation and product decision
   - Approve V1 scope, event list, payload privacy rules, and GO/NO-GO gates.

2. Backend foundation
   - Add database models, VAPID config validation, subscription endpoints, and delivery tracking without sending production pushes.

3. Frontend enrollment
   - Add Service Worker registration, permission state UI, subscription upsert, and disable flow behind a feature flag.

4. Delivery integration
   - Connect created `Notification` rows to async push delivery and retries.

5. Event coverage
   - Enable events in the matrix one group at a time: assignment/status first, then comments/attachments, then SLA/urgent.

6. Stage QA
   - Complete multi-device, multi-tenant, iPhone, Android, and logout testing.

7. Limited production beta
   - Enable for internal users and selected tenants.
   - Monitor delivery and support feedback.

8. General availability
   - Enable tenant/user settings broadly after metrics and privacy checks pass.

# Risks

- iOS Web Push support depends on installation and platform version, so enrollment UX must be explicit.
- Push provider responses are not guaranteed delivery confirmations; V1 should track send attempts, not true user receipt.
- VAPID key rotation can invalidate or require renewal of subscriptions.
- Duplicate notifications can occur if row dedupe and delivery dedupe are not both enforced.
- Push payloads can leak sensitive data on lock screens if too much detail is included.
- Multi-tenant/provider linked-client routing can open the wrong screen if `linkedClientCompanyId` is mishandled.
- Service Worker bugs can be hard to debug after deployment because old workers can remain installed.
- Ticket write latency could regress if push delivery is performed synchronously.

# Recommendation

GO for a phased V1 implementation.

The existing notification model is a good source of truth, and its `(companyId, userId)` scoping plus `dedupeKey` gives the push layer a safe foundation. Do not replace current WebSocket or browser notification behavior. Add Web Push as an asynchronous delivery channel behind feature flags, with strict payload privacy, per-device subscription storage, bounded retries, and tenant-scoped ownership checks.

NO-GO for an immediate broad production rollout until iPhone/Android stage testing, VAPID secret management, logout behavior, and event payload privacy are verified.
