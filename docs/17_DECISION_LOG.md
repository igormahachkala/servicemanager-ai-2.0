# 17 Decision Log

Why the architecture is shaped the way it is.

This is not a changelog. A changelog records what changed; this records **why**, what
was rejected, and what the choice costs going forward. Read it before proposing to
undo something that looks unnecessarily strict — most of these rules exist because the
simpler version failed in production.

Each entry follows the same structure: problem, alternatives, chosen solution, reason,
future implications.

---

## D-01 — Company-level PRIMARY / SECONDARY was removed

### Problem

Provider standing was originally reasoned about at company level: a company "was" a
primary contractor or "was" a subcontractor, and code branched on that label.

The model broke as soon as a real provider participated in more than one relationship.
The same company is a general contractor for one client and a subcontractor for another
— simultaneously. A company-level label cannot express that, so code either picked one
answer and was wrong half the time, or accumulated special cases.

### Alternatives considered

1. **Keep the company label and add exceptions** where a company holds both roles.
2. **Two company records** for the same legal entity, one per standing.
3. **Move the role onto the relationship** — the contract carries the role.

### Chosen solution

Role belongs to the `ServiceContract`. `PRIMARY` and `SECONDARY` are contract roles,
resolved per operation against the contract covering the ticket's client company.

### Reason

The role is a property of a relationship, not of an organisation. Modelling it anywhere
else forces the system to answer a question that has no single answer.

Option 1 grows without bound — every new feature needs its own exception. Option 2
duplicates users, locations and history across two records of the same company and
makes reporting incoherent.

### Future implications

- Never reason about "a secondary company". Always resolve the role for the specific
  contract covering the ticket.
- Company-global helpers such as `listPrimaryLinkedClientIds` still exist as **seeds**:
  they answer "which clients does this provider serve at all" before contract context
  narrows the result. They are not authorization and must not be used as such.
- Any new provider-side rule must take a contract, not a company.

---

## D-02 — Contract Context exists as a first-class concept

### Problem

Before contract context, the pieces of a provider's permitted work area lived in
different places: the contract knew the parties, locations were checked ad hoc, and
specializations existed only on users. There was no single object answering "what may
this provider do for this client".

The consequence was predictable — each caller assembled its own answer, and the answers
drifted. Two screens could disagree about the same ticket, and no test caught it
because each was internally consistent.

### Alternatives considered

1. **Leave the pieces distributed** and document the required order of checks.
2. **Put everything on the user** — give each user an explicit allowed work area.
3. **Introduce a resolved context object** derived from the contract.

### Chosen solution

`ContractContextService` resolves a `ContractContext` containing the contract id, the
parties, the contract role, the contract location scope, and the contract
specialization scope. Contract specializations became a persisted relation rather than
a user-only property.

### Reason

Option 1 is what already existed, and it failed: documentation does not prevent a new
caller from assembling the pieces differently.

Option 2 confuses two different things. What a *relationship* covers and what a *person*
is qualified for are independent facts; collapsing them means a contract change has to
be replayed across every user.

A resolved context makes the correct answer cheaper to obtain than an improvised one —
the only reliable way to stop divergence.

### Future implications

- The contract pair is unique, so context resolution is deterministic: at most one
  contract per `(client, provider)`.
- Parallel resolution paths are a known debt. Where a helper resolves contract scope
  itself instead of calling the canonical service, it must be folded in rather than
  extended.
- New dimensions of scope belong in the context object, not in new helpers.

---

## D-03 — Completion and Acceptance are separate

### Problem

Originally a provider could drive a ticket to `DONE`. That let the party performing the
work certify that the work was acceptable — the provider was both author and reviewer.

Disputes had no artifact to point at: there was no recorded moment at which the client
agreed the job was finished.

### Alternatives considered

1. **Keep provider `DONE`** and handle disputes outside the system.
2. **Optional client confirmation** — provider closes, client may object afterwards.
3. **Mandatory intermediate state** — provider completion produces
   `AWAITING_ACCEPTANCE`; only the client moves it to `DONE`.

### Chosen solution

Option 3. Provider completion is an operational statement — "our work is finished" —
and maps to `AWAITING_ACCEPTANCE` with work evidence. Acceptance is a distinct client
action producing `DONE`; rejection returns the ticket to `IN_PROGRESS`.

### Reason

Option 1 makes the record useless exactly when it matters. Option 2 looks lighter but
produces an ambiguous state: a ticket marked `DONE` that may still be contested is not
a fact, and downstream consumers — SLA, analytics, billing — cannot rely on it.

Separating the two gives every ticket an unambiguous answer to "did the client agree",
recorded with an actor and a timestamp.

### Future implications

- `DONE` means accepted. Any future automation may rely on that.
- Provider actors must never reach `DONE`, including through the generic status
  endpoint — the transition table is the enforcement point, not the acceptance endpoint
  alone.
- Evidence requirements attach to completion, not acceptance.

---

## D-04 — Candidate List must equal Assignment Authority

### Problem

The list of technicians offered for assignment was produced by one query, and the
authorization for the actual assignment by another. They drifted, and the interface
offered people the backend would then refuse.

This reads to the user as an unreliable system, and to support as an intermittent bug
with no reproduction.

### Alternatives considered

1. **Filter the list in the frontend** to hide ineligible candidates.
2. **Let assignment fail** and show a clear error.
3. **Bind the two to one eligibility model** — if a candidate appears, assigning them
   must succeed.

### Chosen solution

Option 3, stated as an invariant: candidate list equals assignment authority. A
mismatch in either direction is a defect.

### Reason

Option 1 is worse than the disease: the API response still contains foreign workforce,
so hiding it client-side is a disclosure problem wearing a UX costume.

Option 2 accepts a broken interface as normal. If the system can compute eligibility at
assignment time, it can compute it when building the list; offering an option it will
refuse is a design failure, not an edge case.

### Future implications

- Every change to assignment eligibility must be applied to both paths in the same
  commit, or ideally to shared code used by both.
- A regression test on this invariant is worth more than tests on either side alone.
- The same reasoning applies to any "available actions" metadata the backend returns:
  if the UI is told an action is available, the action must succeed.

---

## D-05 — Provider Acceptance is forbidden

### Problem

Acceptance is the client's judgement about the provider's work. If any provider role
can perform it, the provider certifies itself, and the acceptance record stops meaning
anything.

The pressure to allow it is real and recurring: a provider admin wants to close old
tickets, or the client is slow to respond.

### Alternatives considered

1. **Allow provider admin acceptance** for operational convenience.
2. **Allow it with an audit marker** distinguishing self-accepted tickets.
3. **Forbid it entirely** for every provider role.

### Chosen solution

Option 3. No provider-side role accepts, including provider `ADMIN`.
`availableActions.canAccept` is false for provider actors, and the mutation is refused.

### Reason

Option 1 destroys the guarantee outright. Option 2 is subtler and worse in practice:
once two kinds of acceptance exist, every downstream consumer must remember to
distinguish them, and eventually one will not. A single meaning for `DONE` is worth more
than the convenience.

The convenience problem is real but belongs elsewhere — timeouts, escalation, or an
explicit client-side delegation would all preserve the meaning of the record.

### Future implications

- The role gate on the acceptance endpoint is **permissive** and lists provider roles;
  the restriction is enforced deeper by company type and ticket ownership. Auditing the
  decorator alone gives the wrong answer, and any refactor must preserve the deeper gate.
- Requests to "let admins close old tickets" must be solved without provider acceptance.

---

## D-06 — Access fails closed

### Problem

When a required input is missing — no contract, unresolvable scope, empty permission
matrix — the system must choose a default. The convenient default is to allow, because
it keeps things working during setup and migration.

### Alternatives considered

1. **Fail open** on missing data, so incomplete configuration does not block work.
2. **Fail open only in specific bootstrap situations.**
3. **Fail closed everywhere**, with an explicit bootstrap mode where genuinely needed.

### Chosen solution

Option 3. Missing contract, expired contract, uncovered location, uncovered
specialization, missing permission block, ineligible target — all deny.

### Reason

This one has a scar. The permission guard once contained:

```ts
if (blocksCount === 0) return true;   // grant everything
```

An empty permission matrix meant every authenticated user could do everything. It was
fixed as a P0 with deny-by-default plus an explicit bootstrap mode and a startup
validator — and then **reintroduced** when a production rollback moved the code back
past that fix.

That sequence is the argument. Fail-open defaults are invisible while data is complete,
which means they are discovered by an incident rather than by testing, and they can
return silently through unrelated operations.

### Future implications

- Empty is never "allow". If a scope resolves to nothing, access is nothing.
- The distinction that matters is *unset* versus *empty*: a user with no explicit
  location mode and no bindings is unconfigured and sees the whole contour; a user with
  an explicit mode and zero locations is deliberately closed. Preserve that distinction
  — collapsing it either breaks everyone or opens everyone.
- Before any rollback, check whether it moves the code back past a fail-closed fix.

---

## D-07 — Management roles ignore Technician Specialization

### Problem

Provider-side visibility applied one restriction to every role: the ticket had to be
assigned to one of the company's executors, or at a location one of its users was bound
to. That is executor reasoning, and it was applied to managers too.

The result was concrete: a subcontractor `ADMIN` received 404 on a ticket inside their
own active contract, correctly covered by contract location and specialization, simply
because it was unassigned and nobody happened to be bound to that location. The person
responsible for assigning the work could not see the work.

### Alternatives considered

1. **Bind managers to locations** so the existing rule produces the right answer.
2. **Give management a separate visibility path.**
3. **Scope the executor restriction to executor roles**, leaving contract scope to
   govern management.

### Chosen solution

Option 3. The operational restriction applies only to executor-oriented roles.
Management visibility is contract, location and specialization — the contract's, not
the individual's.

### Reason

Option 1 mistakes a workaround for a model: it requires every manager to be bound to
every location they might ever oversee, and it silently breaks whenever a new location
is added.

Option 2 creates a second visibility path, which is the failure this architecture
spends most of its effort avoiding.

Contract locations and contract specializations already bound management visibility, so
removing the executor restriction narrows nothing that was protected — it removes a
restriction that was never about relationships in the first place.

### Future implications

- The exempt list is deliberately narrow: `ADMIN`, `MASTER`, `DISPATCHER`. Client-side
  oversight roles remain under the restriction, because it closes a disclosure path for
  them that predates this decision.
- Technician specialization remains executor eligibility and must never become a
  visibility filter — a dispatcher must see work they cannot personally perform in
  order to route it.

---

## D-08 — Notification eligibility follows Contract Context

### Problem

Recipients were selected by role interest lists alone: an event happened, roles were
looked up, notifications were sent. Nothing verified that a recipient could actually
see the ticket the notification described.

A notification is a disclosure. Subject, ticket number, location and requester travel
with it, so a recipient outside the ticket's scope learns things the ticket list would
never have shown them.

### Alternatives considered

1. **Trust the role lists** and treat notifications as low-sensitivity.
2. **Strip content** so notifications reveal nothing beyond "something happened".
3. **Filter every candidate through the canonical readable-access resolver.**

### Chosen solution

Option 3. Role lists became a statement of *interest* — who cares about this event type
— and the access resolver decides *eligibility*, per candidate.

### Reason

Option 1 makes notifications a side channel around the access model.

Option 2 destroys the product value: a notification that says nothing is not worth
sending, and users will open the ticket anyway.

Splitting interest from eligibility keeps both readable and keeps one source of truth
for scope.

### Future implications

- The role arrays are not duplication of access logic — they are event interest. They
  should eventually become configuration rather than code, but they are not the
  authorization layer.
- The resolver runs **per candidate**, which multiplies queries on the hottest path in
  the system. A concurrency bound exists for this reason; further optimization should
  cache the shared parts of the answer rather than skip the check.
- MAX remains an exception: it delivers to a shared group chat without passing the
  resolver. That is a known gap, not a precedent — it should be closed, not copied.

---

## D-09 — Denied ticket reads return 404, not 403

### Problem

A refusal has to say something. `403` is the honest code for "you may not", but it also
confirms the object exists — and existence is itself information when tickets carry
client names, addresses and phone numbers.

### Alternatives considered

1. **Return `403`** for accurate semantics.
2. **Return `404`** and hide existence.
3. **Return `403` only for the owning tenant**, `404` otherwise.

### Chosen solution

Option 2 for ticket reads: the access resolver throws not-found when access is denied.

### Reason

Option 1 turns error codes into an enumeration oracle: a client company could probe
ticket ids and learn how much work a competitor's provider handles.

Option 3 leaks the boundary itself — the switch between codes tells the caller where
their tenant ends.

### Future implications

- **A 404 on an existing ticket is a scope problem, not a missing record.** This
  surprises everyone once; it is the first thing to check when debugging visibility.
- Do not "improve" the error for debuggability. Diagnose with logs and direct database
  queries instead.

---

## D-10 — Migrations move forward only

### Problem

A rollback needs a defined database story. Reversing migrations sounds symmetrical but
is not: some operations cannot be undone, and reversal risks data that was written
after the migration.

### Alternatives considered

1. **Down-migrations** paired with every change.
2. **Restore from backup** on rollback.
3. **Forward-only**, with rollback meaning "redeploy previous code".

### Chosen solution

Option 3. Schema advances; code moves back independently.

### Reason

Option 1 is undermined by the database itself — `ALTER TYPE ... ADD VALUE` cannot be
reversed in PostgreSQL without rebuilding the type and every dependent column. A
guarantee that holds for some migrations and not others is not a guarantee.

Option 2 discards everything written since the backup, which for a live service is a
larger loss than the defect being rolled back.

Forward-only makes rollback cheap and predictable: old code tolerates extra tables and
columns it does not know about.

### Future implications

- New columns must be nullable or defaulted so older code keeps working.
- Enum values are permanent. Before rolling back past a migration that introduced one,
  reassign any rows using it — old code will fail to decode an unknown value.
- Database ahead of code is a normal state. Code ahead of database is the dangerous
  direction, and it is exactly what happens on Stage, which does not apply migrations
  on start.

---

## How To Add To This Log

Add an entry when a decision constrains future work and the reason is not obvious from
the code. Signals: the rule looks unnecessarily strict; someone has proposed undoing it
before; the simpler version was tried and failed.

Record what was rejected and why. An entry listing only the chosen option does not
prevent the alternative from being proposed again next quarter, which is the entire
purpose of the document.

Do not record routine implementation choices here — those belong in commit messages.

## Related Documents

- [02 Architecture](02_ARCHITECTURE.md) — what the system is
- [03 Access Model](03_ACCESS_MODEL.md) — the rules these decisions produced
- [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md) — the resulting capability table
- [13 Troubleshooting](13_TROUBLESHOOTING.md) — the symptoms these decisions cause
- [14 Glossary](14_GLOSSARY.md) — terminology used here
