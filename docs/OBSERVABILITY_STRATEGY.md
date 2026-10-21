# Observability Strategy - ServiceManager.AI

Status: Active

Purpose: define the signals engineers need to diagnose Stage and Production
without changing runtime state.

This is a reference document. For symptom-first debugging, use
[13 Troubleshooting](13_TROUBLESHOOTING.md). For release verification, use
[11 Runtime Acceptance](11_RUNTIME_ACCEPTANCE.md) and
[12 Release Process](12_RELEASE_PROCESS.md).

## Principles

Observability must help answer:

- is the API healthy;
- is the web app healthy;
- is the database reachable;
- did the expected container rebuild or restart;
- did a request fail because of auth, access, workflow, data, or infrastructure;
- did notifications reach the intended delivery channel.

Observability must not expose secrets. Logs and reports must not print:

- passwords;
- JWTs;
- database URLs;
- API tokens;
- private keys;
- raw credential-bearing environment variables.

## Required Runtime Signals

### API

Verify:

- health endpoint status;
- backend container status;
- restart count;
- recent backend logs;
- `500`, `401`, and `403` patterns;
- schema/runtime errors after migrations.

### Web

Verify:

- web health or successful page load;
- frontend image or build identity when relevant;
- browser console errors;
- failed network requests;
- unexpected redirects or retries;
- stale service worker or cached asset symptoms.

### Database

Verify:

- database readiness;
- migration status;
- expected schema objects after migrations;
- backup readiness before Production release;
- rollback and restore procedures when required.

### Notifications

Verify:

- domain event emission;
- notification row creation;
- recipient eligibility;
- Push delivery attempts and results;
- realtime fanout;
- MAX delivery attempts and results.

Notification logs must prove delivery or failure. Absence of errors is not proof
of delivery.

### Uploads And Attachments

Verify:

- upload source path;
- attachment persistence;
- attachment listing and preview;
- backup coverage for Production uploads.

## Logging Standards

Backend code should use structured NestJS logging or the project's existing
logging helpers.

Logs should include useful context such as:

- module or service name;
- operation;
- ticket id or entity id when safe;
- actor id when safe;
- delivery channel;
- error type.

Logs should not include full request bodies when they may contain credentials or
personal data.

## Runtime Acceptance Evidence

Runtime acceptance reports should include:

- environment;
- deployed SHA;
- account or role tested;
- ticket or entity ids used as evidence;
- browser console summary;
- network summary;
- API failures;
- backend log summary;
- unexpected authorization results.

For authorization and workflow changes, evidence must include both:

- frontend action discovery or `availableActions`;
- actual backend mutation result.

## Production Monitoring After Release

After Production deploy, monitor:

- API health;
- web health;
- database health;
- changed container restart count;
- backend logs for the changed surface;
- user-visible workflow errors;
- notification delivery errors;
- MAX TLS or delivery warnings where MAX was affected.

Production monitoring is read-only unless a separate task explicitly authorizes
rollback or remediation.
