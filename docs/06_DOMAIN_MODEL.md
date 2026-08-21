# 06 Domain Model

This document is the canonical domain-entity map for ServiceManager.AI.

It describes the accepted Contract Context model. Provider-side reads and writes
must resolve through:

```text
Service Contract
-> Role In Contract
-> Contract Locations
-> Contract Specializations
-> Allowed Work Area
-> User Permissions
```

No entity below should infer provider authority from a provider company alone.
`PRIMARY` and `SECONDARY` are roles in the current `ServiceContract`.

## Reading Rules

- `Owner` means the business owner of the data, not necessarily the only table
  with a foreign key to it.
- `Can read` and `Can modify` describe the architectural rule. Controllers and
  services must enforce the exact policy for each runtime action.
- Provider-side access to client-owned operational data always requires a valid
  active Contract Context plus location, specialization, and permission checks.
- Frontend, mobile, MAX, push, and realtime clients render backend decisions.
  They do not create independent authorization rules.
- Comments are a user-facing domain entity implemented as `DomainEvent`
  records of type `ticket.comment_added`.
- Attachments are implemented as `TicketAttachment` for tickets and
  `InspectionRunItemAttachment` for inspection items.

## Identity And Tenant Entities

### Company

- Purpose: tenant boundary for client and provider organizations.
- Owner: platform. A company owns its users and its tenant data.
- Main fields: `id`, `name`, `brandName`, `legalName`, `type`, contact fields,
  public request settings, assignment settings, SLA settings, timezone, shift
  auto-close settings, `createdAt`, `updatedAt`.
- Relations: users, locations, specializations, problem categories, tickets,
  equipment, service contracts as client or provider, notifications, work
  shifts, work logs, inspection records, public request logs, agent tasks.
- Can modify: platform administration and authorized company administration for
  company-scoped settings.
- Can read: platform administration; same-company users according to role and
  permissions; provider users only through allowed linked-client context when a
  service needs client identity.
- Related services: `company`, `users`, `permissions`, `service-contracts`,
  `tickets`, `public-request`, `workforce`, `inspection`, `notifications`.

### User

- Purpose: authenticated person or service-facing account that acts inside one
  company.
- Owner: the user's company.
- Main fields: `id`, `companyId`, `email`, password hash, name fields,
  `avatarUrl`, `role`, `isActive`, `isExecutor`, `phone`, `deletedAt`,
  timestamps.
- Relations: company, created tickets, assigned tickets, status changes,
  attachments uploaded, technician specializations, location bindings, access
  scopes, user permissions, notifications, push subscriptions, push preference,
  work shifts, work logs, inspection actor links, agent tasks.
- Can modify: platform administration and authorized same-company user
  administration; users may update supported own profile fields.
- Can read: platform administration; authorized same-company management;
  provider/client surfaces only expose users that are eligible in the current
  tenant or Contract Context.
- Related services: `auth`, `users`, `permissions`, `tickets`, `workforce`,
  `push`, `notifications`, `inspection`, `agent-tasks`.

### Role

- Purpose: action profile used by policies and permission blocks.
- Owner: platform architecture. Roles are enum values, not tenant data.
- Main fields: `UserRole` values: `PLATFORM_ADMIN`, `ADMIN`, `CLIENT_ADMIN`,
  `DISPATCHER`, `MASTER`, `TECHNICIAN`, `CLIENT`, `TERRITORIAL_MANAGER`,
  `NETWORK_DIRECTOR`, `STAFF`.
- Relations: `User.role`, `RolePermission.role`, policy checks, ticket metadata
  and available actions.
- Can modify: code and migration changes only; runtime users can be assigned a
  role by authorized user administration.
- Can read: all authenticated authorization paths may inspect the actor role.
- Related services: `auth`, `users`, `permissions`, `policy`, `tickets`,
  `inspection`, `workforce`.

### PermissionBlock

- Purpose: named capability block used by role and user permission grants.
- Owner: platform authorization model.
- Main fields: `id`, `code`, `name`, `description`, `createdAt`.
- Relations: `RolePermission`, `UserPermission`.
- Can modify: platform administration or seed/migration procedures for
  permission catalog changes.
- Can read: platform administration and authorization services.
- Related services: `permissions`, `policy`.

### RolePermission

- Purpose: default permission grant for a role, optionally scoped by company
  type.
- Owner: platform authorization model.
- Main fields: `id`, `role`, `companyType`, `permissionBlockId`, `createdAt`.
- Relations: `PermissionBlock`; `UserRole`; `CompanyType`.
- Can modify: platform administration or authorized seed/migration procedures.
- Can read: authorization services and platform administration.
- Related services: `permissions`, `policy`.

### UserPermission

- Purpose: user-specific permission grant.
- Owner: the user's company, governed by platform permission rules.
- Main fields: `id`, `userId`, `permissionBlockId`, `createdAt`.
- Relations: `User`, `PermissionBlock`.
- Can modify: platform administration and authorized same-company management.
- Can read: authorization services; authorized management for permission
  screens.
- Related services: `permissions`, `users`, `policy`.

### UserAccessScope

- Purpose: explicit user location-scope mode for a company.
- Owner: the scoped company.
- Main fields: `id`, `userId`, `companyId`, `locationMode`, timestamps.
- Relations: `User`, `Company`, `UserLocationBinding`.
- Can modify: authorized same-company management and platform administration.
- Can read: access resolvers, user administration, ticket read paths, assignment
  and notification eligibility paths.
- Related services: `users`, `permissions`, `tickets`, `service-contracts`.

## Client Operational Catalog

### Location

- Purpose: client-owned operational place where service work happens.
- Owner: client company.
- Main fields: `id`, `clientCompanyId`, `name`, `platformCode`,
  `externalCode`, city/region/address, latitude/longitude, `isActive`,
  `deletedAt`, timestamps.
- Relations: client company, tickets, equipment, inspections, user location
  bindings, technician client bindings, MAX location threads, service contract
  location links.
- Can modify: authorized client management and platform administration.
- Can read: client users in scope; provider users only when the current active
  `ServiceContract` and user scope include the location.
- Related services: `locations`, `tickets`, `service-contracts`, `users`,
  `equipment`, `inspection`, `max-bot`.

### Equipment

- Purpose: client-owned asset at a location that can be referenced by tickets
  and inspections.
- Owner: client company.
- Main fields: `id`, `companyId`, `locationId`, `name`, `type`, `status`,
  timestamps.
- Relations: company, location, tickets, inspection runs, inspection schedules.
- Can modify: authorized client management and platform administration.
- Can read: client users in scope; provider users only through Contract Context
  for the equipment location and relevant operation.
- Related services: `equipment`, `locations`, `tickets`, `inspection`.

### Specialization

- Purpose: service skill category used by contracts, problem categories, and
  technician eligibility.
- Owner: company that defines the specialization catalog.
- Main fields: `id`, `companyId`, `name`, `isActive`, timestamps.
- Relations: problem category specialization links, technician specialization
  links, service contract specialization links.
- Can modify: authorized company management and platform administration.
- Can read: access resolvers, assignment/candidate logic, service contract
  management, problem category configuration.
- Related services: `specializations`, `problem-categories`,
  `service-contracts`, `tickets`, `users`.

### ProblemCategory

- Purpose: client-facing category for classifying ticket work.
- Owner: client company.
- Main fields: `id`, `companyId`, `name`, `instructions`, `isActive`,
  timestamps.
- Relations: client company, tickets, specialization links.
- Can modify: authorized client management and platform administration.
- Can read: client users in scope; provider users through active Contract
  Context when category data is needed for visible tickets or assignment.
- Related services: `problem-categories`, `tickets`, `service-contracts`.

### ProblemCategorySpecialization

- Purpose: join entity that maps a client problem category to required
  specializations.
- Owner: client company through `ProblemCategory`.
- Main fields: `problemCategoryId`, `specializationId`.
- Relations: `ProblemCategory`, `Specialization`.
- Can modify: authorized client management and platform administration.
- Can read: ticket visibility, assignment, claim, notification eligibility, and
  service contract checks.
- Related services: `problem-categories`, `tickets`, `service-contracts`.

## Contract Context Entities

### ServiceContract

- Purpose: active client-provider relationship that defines provider access to
  client work.
- Owner: shared client/provider relationship, administratively governed by
  authorized platform/client/provider management.
- Main fields: `id`, `clientCompanyId`, `providerCompanyId`, `status`, `role`,
  `locationMode`, `startsAt`, `endsAt`, `notes`, timestamps.
- Relations: client company, provider company, service contract locations,
  service contract specializations.
- Can modify: authorized contract-management actors according to permission and
  company context. Runtime task code must not modify contracts unless the task
  is explicitly about contract administration.
- Can read: client and provider management involved in the relationship;
  access resolvers for every provider-side operational check.
- Related services: `service-contracts`, `tickets`, `permissions`,
  `notifications`, `analytics`.

### ServiceContractLocation

- Purpose: explicit location scope for a service contract when `locationMode`
  requires selected locations.
- Owner: the parent service contract and client company.
- Main fields: `id`, `serviceContractId`, `clientCompanyId`, `locationId`,
  `createdAt`.
- Relations: `ServiceContract`, `Company`, `Location`.
- Can modify: same authority as the parent `ServiceContract`.
- Can read: service contract management and provider-side access resolvers.
- Related services: `service-contracts`, `tickets`, `notifications`,
  `analytics`.

### ServiceContractSpecialization

- Purpose: explicit specialization scope for a service contract. It constrains
  which problem categories a provider may see, receive, claim, assign, or be
  notified about.
- Owner: the parent service contract.
- Main fields: `id`, `serviceContractId`, `specializationId`, timestamps.
- Relations: `ServiceContract`, `Specialization`.
- Can modify: same authority as the parent `ServiceContract`.
- Can read: service contract management, ticket read access, candidate
  selection, assignment, claim, request assignment, and notification eligibility.
- Related services: `service-contracts`, `tickets`, `notifications`,
  `assignment`, `analytics`.

### TechnicianClientBinding

- Purpose: operational binding between a provider technician and a client,
  optionally narrowed to a location. It supports current product flows but does
  not replace Contract Context.
- Owner: provider company with client relationship context.
- Main fields: `id`, `providerCompanyId`, `technicianUserId`,
  `clientCompanyId`, `locationId`, timestamps.
- Relations: provider company, technician user, client company, optional
  location.
- Can modify: authorized provider/client/platform management where the workflow
  still exposes this binding.
- Can read: workforce and assignment services, candidate lists, access
  resolvers that still support compatibility paths.
- Related services: `users`, `workforce`, `tickets`, `service-contracts`.

### UserLocationBinding

- Purpose: explicit location access for a user.
- Owner: user's company.
- Main fields: `id`, `userId`, `locationId`, `companyId`, `createdAt`.
- Relations: `User`, `Location`, `Company`.
- Can modify: authorized same-company management and platform administration.
- Can read: access resolvers, ticket queries, assignment/candidate logic,
  notification eligibility.
- Related services: `users`, `permissions`, `tickets`, `service-contracts`.

### TechnicianSpecialization

- Purpose: technician/executor specialization eligibility.
- Owner: technician's company.
- Main fields: `userId`, `specializationId`.
- Relations: `User`, `Specialization`.
- Can modify: authorized provider management and platform administration.
- Can read: ticket access, claim, assignment candidate selection, status
  workflow, and notification eligibility for executor paths.
- Related services: `users`, `specializations`, `tickets`, `workforce`.

## Ticket And Work Entities

### Ticket

- Purpose: service work item from intake through assignment, execution,
  completion, and client acceptance.
- Owner: client company in `Ticket.companyId`.
- Main fields: `id`, `ticketNumber`, `companyId`, `parentId`, `locationId`,
  `equipmentId`, `source`, `publicRequestType`, requester fields, address and
  point fields, `problemCategoryId`, `problemText`, `urgency`, `priority`,
  `urgencyReason`, `status`, `statusUpdatedAt`, SLA timestamps, `closedAt`,
  `assignedTechnicianId`, `createdByUserId`, timestamps.
- Relations: client company, parent/child tickets, location, equipment, problem
  category, assigned technician, creator, status history, attachments,
  inspection run item, work logs.
- Can modify: authorized client actors for client-side ticket operations;
  authorized provider actors only through active Contract Context, location,
  specialization, user scope, role permission, and workflow policy. Providers
  complete work but never perform client acceptance.
- Can read: client users in scope; provider users through active Contract
  Context and current access; direct URLs must pass the same resolver as lists.
- Related services: `tickets`, `workflow`, `policy`, `service-contracts`,
  `timeline`, `notifications`, `uploads`, `inspection`, `workforce`.

### Comment

- Purpose: user-facing discussion or work note attached to a ticket timeline.
- Owner: ticket owner, which is the client company.
- Main fields: represented by `DomainEvent` with `entityType='ticket'`,
  `entityId=<ticket id>`, `type='ticket.comment_added'`, `actorUserId`,
  `payload.comment`, `createdAt`.
- Relations: ticket through `DomainEvent.entityId`, actor user through
  `actorUserId`, notifications through source event handling.
- Can modify: no in-place edit is expected. Creating a comment requires readable
  ticket access and comment permission through the canonical access resolver.
- Can read: any actor who can read the ticket through the canonical access
  resolver.
- Related services: `tickets`, `timeline`, `notifications`, `policy`.

### Attachment

- Purpose: uploaded file associated with ticket intake, work reports, declined
  reports, or inspection evidence.
- Owner: ticket or inspection owner, usually the client company.
- Main fields: for tickets, `TicketAttachment.id`, `companyId`, `ticketId`,
  `uploadedByUserId`, `originalName`, `storageKey`, `mimeType`, `sizeBytes`,
  `url`, `purpose`, `createdAt`; for inspections, equivalent
  `InspectionRunItemAttachment` file metadata and `runItemId`.
- Relations: company, ticket or inspection run item, uploading user.
- Can modify: uploading requires readable target access plus attachment
  permission; source files and metadata must not be changed by unrelated actors.
- Can read: any actor who can read the parent ticket or inspection item through
  the canonical access resolver.
- Related services: `uploads`, `tickets`, `inspection`, `timeline`,
  `notifications`.

### TicketAttachment

- Purpose: concrete persistence model for ticket attachments.
- Owner: ticket owner through `companyId`.
- Main fields: `id`, `companyId`, `ticketId`, `uploadedByUserId`,
  `originalName`, `storageKey`, `mimeType`, `sizeBytes`, `url`, `purpose`,
  `createdAt`.
- Relations: `Company`, optional `Ticket`, optional uploading `User`.
- Can modify: ticket attachment service after ticket read/access checks.
- Can read: actors with readable ticket access.
- Related services: `ticket-attachments`, `uploads`, `tickets`.

### TicketStatusHistory

- Purpose: structured record of ticket lifecycle status changes.
- Owner: ticket owner, which is the client company.
- Main fields: `id`, `ticketId`, `fromStatus`, `toStatus`, `comment`,
  `changedByUserId`, `createdAt`.
- Relations: ticket, changing user.
- Can modify: backend ticket status/acceptance/assignment services when a valid
  transition occurs.
- Can read: actors with readable ticket access.
- Related services: `tickets`, `workflow`, `timeline`, `notifications`.

### WorkShift

- Purpose: time window for a user's operational work day.
- Owner: user's company.
- Main fields: `id`, `companyId`, `userId`, `status`, `openedAt`, `closedAt`,
  `closeReason`, timestamps.
- Relations: company, user, work logs.
- Can modify: the actor for their own shift where allowed, workforce management,
  and auto-close service.
- Can read: the actor, authorized same-company management, analytics/workforce
  services.
- Related services: `workforce`, `analytics`.

### WorkLog

- Purpose: time tracking record for a user working on a ticket within a shift.
- Owner: user's company, linked to the ticket's client company through access
  rules when the ticket is client-owned.
- Main fields: `id`, `companyId`, `userId`, `shiftId`, `ticketId`, `status`,
  `startedAt`, `endedAt`, `durationMinutes`, `notes`, timestamps.
- Relations: company, user, work shift, ticket.
- Can modify: the actor for their own work log where allowed, workforce
  management, and auto-stop/close routines.
- Can read: the actor, authorized same-company management, and ticket/workforce
  services with valid access.
- Related services: `workforce`, `tickets`, `analytics`.

## Notification And Event Entities

### DomainEvent

- Purpose: append-only event log for ticket timeline, comments, assignment
  events, acceptance events, service contract audit, and downstream side
  effects.
- Owner: event company scope in `companyId`.
- Main fields: `id`, `companyId`, `entityType`, `entityId`, `type`,
  `actorUserId`, `payload`, `createdAt`.
- Relations: logical relation to target entity by `entityType`/`entityId`; actor
  user by `actorUserId`; notification scheduling through event type and payload.
- Can modify: backend domain services append events; events are not edited by
  normal users.
- Can read: actors who can read the related entity, plus authorized audit/admin
  surfaces.
- Related services: `events`, `timeline`, `tickets`, `notifications`,
  `service-contracts`.

### Notification

- Purpose: persisted per-user notification item.
- Owner: recipient company/user.
- Main fields: `id`, `dedupeKey`, `companyId`, `userId`, `type`, `title`,
  `message`, `entityType`, `entityId`, `linkedClientCompanyId`, `readAt`,
  `createdAt`.
- Relations: recipient company, recipient user, logical entity reference.
- Can modify: notification services create rows; recipient can mark own
  notifications read where supported.
- Can read: recipient user and authorized notification/admin services.
- Related services: `notifications`, `push`, `realtime`, `max-bot`, `tickets`.

### PushSubscription

- Purpose: browser/device web push endpoint for a user.
- Owner: subscribed user and user's company.
- Main fields: `id`, `userId`, `companyId`, `endpoint`, `p256dh`, `auth`,
  `platform`, `userAgent`, `declarative`, `createdAt`, `lastSeenAt`,
  `failCount`, `disabledAt`.
- Relations: user.
- Can modify: the authenticated user can register/update/remove their own
  subscription; backend disables failed endpoints.
- Can read: push delivery service and authorized diagnostics.
- Related services: `push`, `notifications`.

### PushPreference

- Purpose: per-user push category toggles and quiet hours.
- Owner: user.
- Main fields: `id`, `userId`, category booleans, `quietHoursFrom`,
  `quietHoursTo`.
- Relations: user.
- Can modify: the authenticated user for their own preferences; authorized
  support/admin only where policy permits.
- Can read: user and push delivery service.
- Related services: `push`, `notifications`.

### PushDeliveryLog

- Purpose: diagnostic record for push delivery attempts.
- Owner: platform operational telemetry.
- Main fields: `id`, `subscriptionId`, `eventType`, `entityId`, `status`,
  `createdAt`.
- Relations: logical push subscription reference by `subscriptionId`.
- Can modify: push delivery service only.
- Can read: authorized diagnostics and operations.
- Related services: `push`, `notifications`.

### MaxLocationThread

- Purpose: MAX chat/thread mapping for a client location.
- Owner: client company/location integration configuration.
- Main fields: `id`, `companyId`, `locationId`, `chatId`, `anchorMessageId`,
  `anchorMessageCreatedAt`, timestamps.
- Relations: company, location.
- Can modify: MAX integration runtime and authorized integration management.
- Can read: MAX delivery and command services; authorized diagnostics.
- Related services: `max-bot`, `notifications`, `locations`.

## Assignment Entities

### AssignmentCursor

- Purpose: state for assignment rotation strategies.
- Owner: company whose assignment strategy is being rotated.
- Main fields: `id`, `companyId`, `strategy`, `cursor`, timestamps.
- Relations: company by `companyId`.
- Can modify: assignment service during automatic assignment decisions.
- Can read: assignment service and authorized diagnostics.
- Related services: `tickets`, `assignment`.

### AssignmentDecision

- Purpose: audit/diagnostic record for assignment candidate evaluation.
- Owner: ticket workflow diagnostics.
- Main fields: `id`, `ticketId`, `technicianId`, `candidatesCount`, `reason`,
  `createdAt`.
- Relations: logical ticket and technician references.
- Can modify: assignment service when making or rejecting an assignment
  decision.
- Can read: authorized management and diagnostics.
- Related services: `tickets`, `assignment`, `workforce`.

## Public Request Entities

### PublicRequestLog

- Purpose: rate-limit and audit log for public request intake.
- Owner: client company that owns the public request entry point.
- Main fields: `id`, `companyId`, `tokenHash`, `ipHash`, `phoneHash`,
  `locationId`, `channel`, `action`, `createdAt`.
- Relations: company.
- Can modify: public request service only.
- Can read: authorized operations and diagnostics; never use it to expose raw
  requester secrets.
- Related services: `public-request`, `tickets`.

## Inspection Entities

### InspectionTemplate

- Purpose: reusable inspection checklist definition.
- Owner: company that defines the inspection process.
- Main fields: `id`, `companyId`, `name`, `description`, `isActive`,
  timestamps.
- Relations: company, template items, runs, schedules.
- Can modify: authorized company management and platform administration.
- Can read: authorized same-company users and inspection services.
- Related services: `inspection`.

### InspectionTemplateItem

- Purpose: one checklist line in an inspection template.
- Owner: parent inspection template.
- Main fields: `id`, `templateId`, `title`, `description`, `sortOrder`,
  `isRequired`, timestamps.
- Relations: template, generated run items.
- Can modify: authorized template management.
- Can read: users who can read the template or resulting inspection run.
- Related services: `inspection`.

### InspectionRun

- Purpose: concrete execution of an inspection template at a location and
  optionally an equipment item.
- Owner: company that owns the inspection run.
- Main fields: `id`, `companyId`, `templateId`, `locationId`, `equipmentId`,
  actor/report fields, `title`, `status`, `reportStatus`, schedule/due fields,
  completion fields, timestamps.
- Relations: company, template, location, equipment, schedule, performer,
  report submitter/reviewer, run items.
- Can modify: assigned/authorized inspection actors and management according to
  inspection policy.
- Can read: authorized same-company users; provider/client cross-access must
  still be mediated by the relevant service policy.
- Related services: `inspection`, `uploads`, `tickets`.

### InspectionSchedule

- Purpose: recurring plan for generating inspection runs.
- Owner: company that owns the schedule.
- Main fields: `id`, `companyId`, `templateId`, `locationId`, `equipmentId`,
  `assignedToUserId`, `createdByUserId`, `name`, `frequency`, `intervalDays`,
  `startDate`, `nextDueAt`, lead/grace days, `isActive`, `lastGeneratedAt`,
  `lastRunId`, timestamps.
- Relations: company, template, location, equipment, assigned user, creator,
  generated runs.
- Can modify: authorized inspection management and schedule generation jobs.
- Can read: authorized same-company inspection users and operations.
- Related services: `inspection`.

### InspectionRunItem

- Purpose: concrete checklist item inside an inspection run.
- Owner: parent inspection run.
- Main fields: `id`, `runId`, `templateItemId`, `title`, `description`,
  `sortOrder`, `isRequired`, `status`, `requiresRepair`, `comment`, `ticketId`,
  timestamps.
- Relations: inspection run, optional template item, optional repair ticket,
  attachments.
- Can modify: authorized inspection performer or reviewer according to report
  workflow.
- Can read: users who can read the parent inspection run; repair-ticket links
  still require ticket access.
- Related services: `inspection`, `tickets`, `uploads`.

### InspectionRunItemAttachment

- Purpose: uploaded evidence file for an inspection run item.
- Owner: company that owns the inspection run item.
- Main fields: `id`, `companyId`, `runItemId`, `originalName`, `storageKey`,
  `mimeType`, `sizeBytes`, `url`, `createdAt`.
- Relations: company, inspection run item.
- Can modify: upload service after inspection access checks.
- Can read: users who can read the parent inspection run item.
- Related services: `inspection`, `uploads`.

## Internal Engineering Tooling Entity

### AgentTask

- Purpose: internal automation task record for Engineering Agent workflows.
  This is not a ServiceManager customer business entity, ServiceManager core
  domain, or separate product feature.
- Owner: company context in which the task was created.
- Main fields: `id`, `companyId`, `createdByUserId`, `title`, `prompt`,
  `status`, `result`, timestamps.
- Relations: company, optional creator user.
- Can modify: authorized internal agent-task API and task runner.
- Can read: authorized internal company/platform users and automation
  diagnostics.
- Related services: `agent-tasks`.

## Enumerations

The schema uses enums as controlled value sets:

- `CompanyType`: client or provider tenant classification.
- `UserRole`: runtime role/action profile.
- `ServiceContractStatus`, `ServiceContractRole`,
  `ServiceContractLocationMode`: Contract Context state and scope.
- `TicketStatus`, `TicketUrgency`, `TicketPriority`, `TicketSource`,
  `TicketAttachmentPurpose`: ticket lifecycle, intake, SLA, and attachment
  classification.
- `UserAccessLocationMode`: user-level location scope mode.
- `WorkShiftStatus`, `WorkLogStatus`: workforce time-tracking state.
- `PublicRequestType`: public intake request type.
- `InspectionRunStatus`, `InspectionRunItemStatus`,
  `InspectionReportStatus`, `InspectionFrequency`: inspection workflow and
  scheduling state.
- `AgentTaskStatus`: automation task state.

Enums can be read anywhere the owning entity is read. Changing enum values is a
schema and application compatibility change and must go through the normal
migration, build, test, Stage, and acceptance path.
