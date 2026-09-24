# 13 Troubleshooting

Practical guide to the failures this system actually produces. Each entry names the
symptom, the layer it lives in, the first checks, the canonical files, and — often the
most useful part — what not to do.

## How To Use This

Work top-down: **environment before code**. Most reports of "the fix does not work"
turn out to be a stale image or an unapplied migration, not a defect. Two commands
answer that before you read any source:

```bash
docker exec sma_stage_backend sh -c "grep -rl 'yourFunctionName' /app/dist | head -1"
docker exec sma_stage_postgres psql -U sma_user -d sma_stage_db -t -A \
  -c "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL;"
```

If the first prints nothing, you are looking at code that is not deployed. Stop there.

---

## HTTP Status Codes

### 401 Unauthorized

**Symptom.** Login works, then requests start failing. Or login itself fails on one
browser but not another.

**Likely layer.** Token lifetime, refresh session state, or browser storage.

**First checks.**
1. Is the token simply expired? Check the `exp` claim.
2. Does `GET /auth/me` fail with the same token? If yes, the token is the problem.
3. Does the failure follow one browser or one device? That points at storage, not auth.
4. Safari and private windows enforce stricter storage quotas — a failed write can
   leave the client without a usable token while the server is healthy.

**Canonical files.** `auth/auth.service.ts`, `auth/auth-token-policy.ts`,
`auth/jwt.guard.ts`, `web/src/lib/` storage helpers.

**What NOT to do.** Do not lengthen token lifetime to make a symptom disappear. Do not
disable `JwtAuthGuard` on an endpoint "temporarily" — that guard is the only thing
standing in front of several endpoints that have no role decorator.

---

### 403 Forbidden

**Symptom.** The user is authenticated, the UI shows the action, the request is refused.

**Likely layer.** Permission block, or a deeper policy check.

**First checks.**
1. Which gate refused? The response carries `code: 'PERMISSION_DENIED'` and the missing
   permission name when it is the permission gate.
2. Look up the endpoint in [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md). If the
   cell is `D`, the answer is "by design".
3. If the cell is `C`, the refusal came from a resolver or policy, not from the gate —
   go to *Ticket not visible* below.
4. Confirm the actor's `(role, companyType)` pair. The same role behaves differently in
   a client and a provider company.

**Canonical files.** `common/permissions.guard.ts`, `common/roles.guard.ts`,
`common/permissions.constants.ts`, `policy/tickets.policy.ts`.

**What NOT to do.** Do not grant the user a broader permission block to unblock them.
Do not add the role to the `@Roles(...)` list without checking whether the deeper gate
was the actual refuser — widening the role gate often changes nothing except the audit
trail.

> A 403 that only appears for provider roles on acceptance is not a bug. Providers can
> never accept client work. See §*Acceptance denied*.

---

### 404 Not Found

**Symptom.** A ticket that demonstrably exists returns "Ticket not found".

**Likely layer.** Access resolver — almost always.

This is the single most misleading status in the system. **The access resolver throws
`NotFoundException` rather than `ForbiddenException` on purpose**, so that a caller
cannot use error codes to discover which tickets exist outside their scope. A 404 on a
ticket detail usually means "you may not see this", not "this is missing".

**First checks.**
1. Does the ticket exist at all? Query by id directly in the database.
2. If it exists, treat this as a visibility problem and go to the next section.

**Canonical files.** `tickets/ticket-access.utils.ts`.

**What NOT to do.** Do not change the exception type to make debugging easier. That
choice is a security property.

---

### 500 Internal Server Error

**Symptom.** Requests fail with no useful client-side message.

**Likely layer.** Prisma client, migration state, or an unguarded side path.

**First checks.**
1. `docker logs sma_stage_backend --tail 200` — read the actual exception.
2. `PrismaClientInitializationError` at startup means schema and client disagree — see
   *Prisma errors*.
3. If the 500 appears only under load, check the connection pool — see *Prisma errors*.
4. If a 500 appeared right after a deploy that added a diagnostic or observability
   path, suspect that path: a throw inside a side-channel converts a successful
   business operation into a failed request.

**Canonical files.** `prisma/prisma.service.ts`, `main.ts`.

**What NOT to do.** Do not wrap the controller in a catch-all that returns 200. Do not
restart the container to clear the symptom before capturing the log.

---

## Access And Visibility

### Ticket not visible

**Symptom.** A user cannot see a ticket they believe they should see. Direct URL gives
404, or the board is empty.

**Likely layer.** Contract, location, or specialization scope — in that order.

**First checks.** Walk the chain from [03 Access Model](03_ACCESS_MODEL.md) in order.
Each step fails closed, so the first failing step is the answer.

1. **Contract.** Is there an active `ServiceContract` between the provider company and
   the ticket's client company? Check `status`, `startsAt`, `endsAt`. An expired or
   draft contract is invisible to the resolver.
2. **Contract role.** Is the provider `PRIMARY` or `SECONDARY` for that contract? The
   two paths behave differently.
3. **Contract locations.** Does the contract cover the ticket's location? Watch for
   `INHERIT_PRIMARY` — a secondary contract may inherit from the primary one.
4. **Contract specializations.** Does the contract cover the ticket category's
   specialization?
5. **User location scope.** Does the user's own binding set still include the location
   after intersection with the contract? A user with zero bindings and no explicit mode
   sees the whole contour; a user with an explicit mode and zero locations sees nothing.
6. **Technician specialization.** Only for `TECHNICIAN`, and only for executor
   eligibility — never for management visibility.

**Canonical files.** `tickets/ticket-access.utils.ts`,
`service-contracts/contract-context.service.ts`,
`common/user-access-scope-mode.utils.ts`.

**What NOT to do.** Do not add a location binding or a specialization to the user to
"fix" it before you know which step failed — you may be masking a contract problem and
widening access at the same time. Do not special-case the role.

> Management roles must not require technician-style operational bindings. If an
> `ADMIN`, `MASTER` or `DISPATCHER` sees 404 on a ticket inside their own contract
> scope, that is a defect, not a configuration problem.

---

### Wrong provider visibility

**Symptom.** A provider sees tickets of a client they should not, or a secondary
provider sees a whole client contour.

**Likely layer.** Contract context resolution.

**First checks.**
1. List every active contract for that provider company. A provider may legitimately
   be `PRIMARY` for one client and `SECONDARY` for another — role is per contract, not
   per company.
2. Confirm the resolver used the contract for the **ticket's** client company, not a
   different one.
3. Check whether the path went through the canonical `ContractContextService` or
   through a parallel helper. Parallel resolution is the usual root cause of "two
   screens disagree".

**Canonical files.** `service-contracts/contract-context.service.ts`,
`tickets/ticket-access.utils.ts`, `tickets/tickets.query.service.ts`.

**What NOT to do.** Do not narrow visibility with a company-level filter as a patch.
Company-global reasoning is what the contract context replaced.

---

### Wrong candidate list

**Symptom.** The assignment dropdown shows a technician who cannot actually be
assigned, or omits one who can.

**Likely layer.** Candidate eligibility, which must equal assignment authority.

**First checks.** For each unexpected candidate, verify in order: active, not deleted,
executor-capable role, `isExecutor=true`, inside the eligible workforce contour,
location allowed, specialization allowed, contract context covers the ticket.

The rule is stated in [03 Access Model](03_ACCESS_MODEL.md): **if a technician appears
in candidates, assigning that technician must succeed.** A mismatch in either direction
is a defect.

**Canonical files.** `tickets/tickets.assignment.service.ts`,
`tickets/ticket-access.utils.ts`.

**What NOT to do.** Do not filter the list in the frontend. A candidate list filtered
client-side still exposes foreign workforce in the API response.

---

### Claim denied

**Symptom.** A technician cannot take an unassigned ticket that appears on their board.

**Likely layer.** Claim eligibility, contract role, or company flag.

**First checks.**
1. Is the actor an eligible executor — `isExecutor=true` and an executor-capable role?
2. Is the ticket `NEW` and unassigned?
3. Is the provider `SECONDARY` for this client's contract? **Secondary providers cannot
   directly claim client-created or primary-created work.** They must request
   assignment instead. This is expected behavior, not a defect.
4. Is `Company.allowTechnicianClaim` true for the provider company? It defaults to
   `true`, so an explicit `false` is a deliberate configuration.
5. Does the specialization match?

**Self-created exception.** If the actor created the ticket, they may take it into work
when they are an eligible executor and the ticket sits inside valid contract, location
and specialization scope. Creating a ticket does not make a non-executor an executor.

**Canonical files.** `tickets/tickets.assignment.service.ts`,
`tickets/ticket-access.utils.ts`.

**What NOT to do.** Do not flip `allowTechnicianClaim` on a company to unblock one
user — the flag is company-wide and affects every contract that company participates in.

---

### Acceptance denied

**Symptom.** A provider-side user cannot accept completed work, or `canAccept` is false
where it was expected true.

**Likely layer.** Acceptance access — by design.

**First checks.**
1. Is the actor in a provider company? Then this is correct and final. **Provider roles
   never perform client acceptance**, including `ADMIN`.
2. Is the actor in the client company that owns the ticket? Acceptance is client-side
   and ticket-ownership-scoped.
3. Is the ticket in `AWAITING_ACCEPTANCE`?

**A trap worth knowing.** The role gate on the acceptance endpoint is permissive and
lists provider roles. The client-only restriction is enforced deeper. Reading the
decorator alone gives the wrong answer — see the commentary in
[08 Permissions Matrix](08_PERMISSIONS_MATRIX.md).

**Canonical files.** `tickets/ticket-acceptance-access.ts`,
`tickets/tickets.acceptance.service.ts`.

**What NOT to do.** Do not add a provider role to the acceptance path. Do not let a
provider move `AWAITING_ACCEPTANCE -> DONE` through the status endpoint — that is the
same bypass by another route.

---

### Completion denied

**Symptom.** A technician cannot complete a ticket, or completion produces
`AWAITING_ACCEPTANCE` when `DONE` was expected.

**Likely layer.** Workflow transition table or evidence requirements.

**First checks.**
1. `AWAITING_ACCEPTANCE` is the **correct** result of provider completion. Completion
   is an operational action; finalization belongs to the client.
2. Is the required work evidence attached? Completion requires evidence according to
   current rules — a missing report attachment refuses the transition.
3. Is the transition allowed from the current status by the workflow table?
4. Is the actor the assigned executor?

**Canonical files.** `tickets/tickets.status.service.ts`, `workflow/ticket.workflow.ts`.

**What NOT to do.** Do not add `DONE` as a provider-reachable transition. Do not relax
evidence requirements to unblock a single ticket.

---

## Environment

### Stage running a stale image

**Symptom.** A fix is merged and deployed, and the behavior has not changed.

**Likely layer.** Deployment, not code.

**First checks.**
```bash
docker exec sma_stage_backend sh -c "grep -rl 'yourFunctionName' /app/dist | head -1"
docker image inspect $(docker inspect sma_stage_backend --format '{{.Image}}') \
  --format '{{.Created}}'
```
Empty output from the first command means your code is not in the running image.
Container status `Up` and a recent start time prove nothing — a nine-day-old container
can be running a two-month-old image.

**What NOT to do.** Do not restart the container expecting new code. Do not report
acceptance results from an environment you have not verified — a pass against a stale
build is worse than no run.

---

### Migration mismatch

**Symptom.** Runtime errors about missing tables or columns; `migrate status` reports
drift; a feature works locally and fails on Stage.

**Likely layer.** Database schema versus deployed code.

**The structural fact.** Production runs migrations on every container start:

```yaml
command: sh -lc "npx prisma migrate deploy && npm run start:prod"
```

**Stage does not.** `docker-compose.stage.yml` has no `command:` override, so the image
`CMD` runs the app without `migrate deploy`. A Stage redeploy therefore does **not**
apply migrations, and Stage can sit many migrations behind indefinitely.

**First checks.**
```bash
docker exec sma_stage_postgres psql -U sma_user -d sma_stage_db -t -A \
  -c "SELECT COUNT(*) FILTER (WHERE finished_at IS NOT NULL),
             COUNT(*) FILTER (WHERE finished_at IS NULL),
             COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)
      FROM \"_prisma_migrations\";"
```
Compare with the migration count in the deployed commit. Confirm the specific table or
column exists via `information_schema`.

**What NOT to do.** Do not edit `_prisma_migrations` by hand. Do not delete migration
rows. Do not run `migrate reset` against a shared environment. Do not run
`migrate dev` outside local development — it can drop data.

> Database ahead of code is a normal and safe state after a code rollback:
> `migrate deploy` ignores applied migrations that are absent from the folder. Code
> ahead of database is the dangerous direction.

---

### Prisma errors

**Symptom.** Unknown types at build time; `P2024`; `P2025`; client/schema mismatch.

**First checks.**

| Signal | Cause | Action |
|---|---|---|
| Unknown Prisma types after `npm ci` | client not generated | `npm run prisma:generate` |
| Types wrong after editing `schema.prisma` | stale client | regenerate |
| `P2025` | record not found for the operation | usually an access or ordering problem, not Prisma |
| `P2024` pool timeout | connection pool exhausted | see below |

**On pool exhaustion.** `connection_limit` is not configured, so Prisma's default
applies — roughly `cores * 2 + 1`, which on a small host is single digits. A burst of
concurrent per-recipient or per-row queries can saturate it and stall unrelated
requests. Look for a fan-out that issues one query chain per item.

**What NOT to do.** Do not raise `connection_limit` as a first response — find the
fan-out. Do not add `prisma generate` to runtime startup.

---

### Frontend stale build

**Symptom.** A frontend change does not appear on Stage after redeploy.

**Likely layer.** Image build, not the container.

**The reason.** `web/Dockerfile` bakes `VITE_API_BASE_URL` through a build `ARG`, and
`vite preview` serves static output. **Frontend changes require rebuilding the image.**
Restarting the container changes nothing, because the built assets are already inside it.

**First checks.** Rebuild `stage_web`, then hard-reload the browser. If the old bundle
persists, it is a client cache or service worker — see below.

**What NOT to do.** Do not edit files inside a running container.

---

### Mobile and PWA problems

**Symptom.** The mobile interface shows old data or an old build; completed tickets are
missing; a form cannot be scrolled to its buttons.

**First checks.**
1. **Old build.** The PWA registers a service worker. After a rebuild, an old worker can
   keep serving cached assets. Verify with an unregistered worker or a fresh profile
   before assuming a code defect.
2. **Completed tickets empty.** The board hides `DONE` tickets closed more than seven
   days ago unless `includeArchived` is set, and `take` is a global budget ordered by
   `createdAt desc` — so old completed tickets fall outside the newest page even with
   the flag. A list scoped to the archived status is the correct approach.
3. **Modal cannot scroll.** Long forms inside a fixed-position backdrop need an internal
   scroll container; without one the top of the form is pushed off-screen.

**Canonical files.** `web/src/mobile/`, `tickets/tickets.query.service.ts`.

**What NOT to do.** Do not add mobile-specific access rules. Mobile uses the same
backend and the same resolver; a fix that only changes mobile behavior usually means
logic leaked into the client.

---

### Push problems

**Symptom.** Notifications appear in the app but not as push.

**Likely layer.** Subscription, preference toggle, or delivery — in that order.

**First checks.**
1. Does the user have an active `PushSubscription`? No subscription, no push. This is
   the most common cause and is not a defect.
2. Is the relevant `PushPreference` toggle enabled for that event type?
3. Did the in-app notification exist at all? Push follows the same recipient decision —
   if the user was not an eligible recipient, there is nothing to deliver.
4. Are VAPID keys configured?

**Canonical files.** `push/push.service.ts`, `notifications/notifications.service.ts`.

**What NOT to do.** Do not treat missing push as an access defect before confirming a
subscription exists. Push adds no visibility of its own.

---

### MAX problems

**Symptom.** `max_bot_poll_failed`; `unable to get local issuer certificate`; group
messages not arriving.

**First checks.**

1. **TLS chain.** `unable to get local issuer certificate`
   (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`) means the container cannot verify the MAX API
   certificate. There is no TLS configuration in the MAX code — it uses plain `fetch` —
   so this is an image property. Check that CA certificates are installed and that
   `NODE_EXTRA_CA_CERTS` is set inside the container:
   ```bash
   docker exec sma_stage_backend printenv NODE_EXTRA_CA_CERTS
   ```
   An empty value means the image lacks the CA setup. **Rebuilding is required** — this
   cannot be fixed by restart or environment change alone if the CA bundle is absent.

2. **Polling versus webhook.** The polling loop does not start when
   `MAX_BOT_WEBHOOK_ENABLED=true`; it returns before making any HTTPS request. So in
   webhook mode, the *absence* of TLS errors proves nothing about the certificate fix.

3. **Group delivery.** Outbound group messages require a token and
   `MAX_GROUP_CHAT_ID`. With an empty group id the send is skipped silently.

4. **Command handling.** Inbound Work Console commands require
   `MAX_BOT_COMMANDS_ENABLED=true`, which is independent of group delivery.

**What NOT to do.** Do not disable TLS verification. Do not add MAX-specific visibility
logic — MAX is a transport, and its current group delivery already bypasses the access
resolver, which is a known limitation rather than a pattern to extend.

---

### Browser storage problems

**Symptom.** Login fails or the session is lost on one browser, typically Safari or a
private window; errors mention quota.

**Likely layer.** Client storage, not authentication.

**First checks.**
1. Reproduce in a normal window of the same browser. If it works there, it is quota or
   partitioning, not credentials.
2. Check whether storage writes are guarded. An unguarded write that throws can abort a
   login flow that would otherwise succeed.
3. Clear site data and retry once, to separate a corrupt entry from a systematic limit.

**Canonical files.** `web/src/lib/` storage helpers.

**What NOT to do.** Do not move tokens to less safe storage to avoid a quota error.

---

### CORS

**Symptom.** Requests fail in the browser with a CORS message while the same request
succeeds from `curl`.

**Likely layer.** Backend origin allowlist.

**First checks.**
1. The allowed origins are configured per environment. On Stage they are set in
   `docker-compose.stage.yml` under `CORS_ALLOWED_ORIGINS`; the value must contain the
   exact origin the browser sends, including scheme and port.
2. A frontend built against one API base URL and served from another origin will always
   fail — the API base is baked at build time.
3. A failed preflight can surface as `401` or a network error rather than an explicit
   CORS message.

**What NOT to do.** Do not allow `*`. Do not disable credentials to make preflight pass.

---

### Attachments and uploads

**Symptom.** Upload fails; a file uploads but cannot be downloaded; files disappear
after redeploy.

**First checks.**
1. **Type and size.** Images and video have separate limits; video is capped at 100 MB
   and restricted to `video/mp4`, `video/quicktime`, `video/webm`, `video/x-m4v`.
2. **Access.** Attachment endpoints have no visibility logic of their own. If the actor
   cannot read the ticket, attachments fail closed — diagnose it as a visibility
   problem.
3. **Persistence.** Production mounts `./uploads` as a volume, so files survive
   rebuilds. If files vanish after a deploy, the volume mount is the thing to check.
4. **Purpose.** `REQUEST`, `WORK_REPORT`, `DECLINE_REPORT` affect workflow evidence
   requirements, not authorization.

**Canonical files.** `tickets/ticket-attachments.service.ts`,
`tickets/ticket-attachment-media.ts`, `uploads/uploads.controller.ts`.

**What NOT to do.** Do not serve uploads from outside the controlled path. Do not raise
size limits without checking the reverse proxy limit as well.

---

## Rules That Apply Everywhere

- **Never widen access to unblock one user.** Find the failing layer first. A binding
  or permission added to clear a symptom usually hides the real cause and grants more
  than intended.
- **Never edit migration history by hand.** Forward-only, always.
- **Never run destructive seeds against a shared environment.** In particular
  `seed:permissions` begins by deleting the role-permission table.
- **Capture evidence before restarting.** A restart destroys the log that would have
  identified the cause.
- **Verify the deployed artifact before diagnosing code.** Most "the fix does not work"
  reports end here.

## Related Documents

- [03 Access Model](03_ACCESS_MODEL.md) — the rules behind every visibility failure
- [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md) — whether a refusal is by design
- [14 Glossary](14_GLOSSARY.md) — terminology used above
- [04 Development Workflow](04_DEVELOPMENT_WORKFLOW.md) — Stage and production behavior
