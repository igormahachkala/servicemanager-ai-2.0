# API Spec - ServiceManager.AI

Base URL (dev, local WSL):

`http://localhost:3001`

Auth:

`Bearer JWT`

All tenant-scoped operational requests must resolve `companyId` from JWT.

---

# 1. AUTH

## POST /auth/register

Public self-service company registration is disabled.

Behavior:

- does not create company
- does not create first admin
- always returns `403 Forbidden`

Response:

```json
{
  "statusCode": 403,
  "message": "Self-service company registration is disabled. Contact platform administrator.",
  "error": "Forbidden"
}
```

## POST /auth/login

Authenticates an existing user.

## GET /auth/me

Returns current user profile:

- `id`
- `email`
- `role`
- `companyId`
- `companyName`

---

# 2. CLOSED ONBOARDING MODEL

Public user:

- `/login`
- `/request-access`

`PLATFORM_ADMIN`:

- `GET /companies`
- `POST /companies`
- `POST /companies/:id/admins`

Only `PLATFORM_ADMIN` provisions companies and first tenant admins.

---

# 3. COMPANY MODEL V2

Unified company model:

- `CLIENT`
- `PROVIDER`

Company creation is platform-only. Company type is a first-class field in both backend and frontend.

## GET /companies

Platform-only company list. Returns companies with:

- `id`
- `name`
- `type`
- public intake settings
- first admins summary

## POST /companies

Platform-only company creation.

Request:

```json
{
  "name": "Acme Retail",
  "type": "CLIENT",
  "timezone": "Europe/Moscow"
}
```

`type` may be `CLIENT` or `PROVIDER`.

## POST /companies/:id/admins

Platform-only creation of the first tenant admin for a company.

## GET /company

Tenant admin company settings. Also returns service relationship summary for the current company:

- `clientContracts[]` if the company acts as a client
- `providerContracts[]` if the company acts as a provider

Provider visibility in future phases will be based on active service relationships, not on role alone.

---

# 4. SERVICE CONTRACTS

Service relationships are explicit links between one `CLIENT` company and one `PROVIDER` company.

Status enum:

- `DRAFT`
- `ACTIVE`
- `INACTIVE`
- `ENDED`

Role enum:

- `PRIMARY`
- `SECONDARY`

Rules:

- client company and provider company must be different
- client side must be `CLIENT`
- provider side must be `PROVIDER`
- current write access level: `PLATFORM_ADMIN` only
- provider visibility is granted only through an `ACTIVE` contract
- `PRIMARY` provider may read linked client operational overview
- `SECONDARY` provider stays restricted and does not receive full client visibility

## POST /service-contracts

Request:

```json
{
  "clientCompanyId": "uuid",
  "providerCompanyId": "uuid",
  "status": "ACTIVE",
  "role": "PRIMARY",
  "startsAt": "2026-03-26",
  "endsAt": "2026-12-31",
  "notes": "Pilot support contract"
}
```

## GET /service-contracts

Platform-only list of all service contracts.

## GET /service-contracts/:id

Platform-only single contract.

## PATCH /service-contracts/:id

Updates:

- `status`
- `role`
- `startsAt`
- `endsAt`
- `notes`

## GET /service-contracts/linked-clients

Provider-company read endpoint.
Returns only `ACTIVE` linked client companies for the current provider.
Each item includes:

- contract id, status, role
- client company summary
- open tickets count
- locations count
- public intake enabled flag

## GET /service-contracts/linked-providers

Client-company read endpoint.
Returns only `ACTIVE` linked providers for the current client company.

## GET /companies/:id/service-contracts

Platform-only list of service contracts for a single company.

---

# 5. PROVIDER VISIBILITY PHASE B

Provider visibility is relationship-aware:

- without an `ACTIVE` contract, provider sees nothing from client company
- with an `ACTIVE PRIMARY` contract, provider may read linked client board and analytics overview
- with an `ACTIVE SECONDARY` contract, provider remains in restricted mode

Read APIs re-used in Phase B:

- `GET /tickets/board?linkedClientCompanyId=...`
- `GET /tickets?linkedClientCompanyId=...`
- `GET /analytics/overview?linkedClientCompanyId=...`

# 6. PUBLIC QUICK REQUEST V2

Public mobile intake without JWT.

## GET /public/request/context/:token?locationId=...

Response fields:

- `companyName`
- `introText`
- `publicRequestEnabled`
- `requestTypes`
- `defaultRequestType`
- `featureFlags.photoUpload`
- `limits.maxPhotos`
- `limits.requirePhone`
- `presetLocationMode`
- `presetLocation`

## GET /public/request/locations/:token

Returns only active locations for the company bound to the public token.

## GET /public/request/locations/:locationId/equipment?token=...

Returns only equipment from the selected location inside the company bound to the public token.

## POST /public/request/:token

Creates a normal operational ticket from the public mobile flow.

Supported fields:

- `locationId`
- `equipmentId?`
- `requestType` = `repair | note`
- `description`
- `phone?`
- `name?`
- `presetLocationId?`
- `channel?` = `qr | direct_link`
- `publicLinkVersion?`
- `photos[]`

The created ticket stores:

- `source = PUBLIC_QUICK_REQUEST`
- `locationId`
- `equipmentId?`
- `requesterPhone`
- public intake metadata in timeline/event payloads

Public endpoints may return `429` when company public intake rate limiting is enabled.

---

# PLATFORM ADMIN OBSERVER SCOPE

`PLATFORM_ADMIN` may read tenant operational data for any company only through an explicit observer scope.

Rules:

- observer access is read-only in intent
- observer scope requires explicit `companyId`
- existing tenant behavior stays unchanged when `companyId` is absent
- non-platform actors do not gain cross-company access through `companyId`

Supported observer reads:

- `GET /tickets/board?companyId=...`
- `GET /analytics/overview?companyId=...`
- `GET /company?companyId=...`
- `GET /users?companyId=...`
- `GET /locations?companyId=...`
- `GET /tickets/:id?companyId=...`

Observer responses may include:

- `meta.scopeCompanyId`
- `meta.visibilityMode = platform_observer`
