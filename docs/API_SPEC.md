# API SPEC — ServiceManager.AI

Base URL (dev): http://localhost:3000  
Auth: Bearer JWT

## Auth
### POST /auth/register
Request:
{ "companyName": "...", "email": "...", "password": "..." }
Response:
{ "access_token": "..." }

### POST /auth/login
Request:
{ "email": "...", "password": "..." }
Response:
{ "access_token": "..." }

### GET /auth/me
Auth required.
Response:
{ "id": "...", "email": "...", "role": "...", "companyId": "..." }

## Company
### GET /company
Auth required.
Response:
{ "id": "...", "name": "...", "autoAssignEnabled": true }

### PATCH /company/auto-assign
Auth required. ADMIN only.
Request:
{ "enabled": false }
Response:
{ "id": "...", "autoAssignEnabled": false }

## Tickets
### POST /tickets
Auth required (ADMIN/DISPATCHER).
Request:
{ ... }
Response:
{ "ticket": {...}, "instructions": "...", "candidates": [...], "autoAssigned": true/false }

### GET /tickets
Auth required.
Response:
[ { ticket... }, ... ]

### PUT /tickets/:id/assign/:technicianId
Auth required (ADMIN/DISPATCHER).
Response:
{ updated ticket... }

### POST /tickets/:id/child
Auth required (ADMIN/DISPATCHER).
Request:
{ "problemCategoryId": "...", "problemText": "...", "urgency": "NOT_URGENT" }
Response:
{ "ticket": {...}, "parentId":"...", ... }
