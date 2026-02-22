# SECURITY MODEL — ServiceManager.AI

---

## 1. Multi-tenant Isolation

Every domain entity contains:
companyId

All queries must:
- Filter by companyId
- Use req.user.companyId from JWT

No cross-company access is allowed.

---

## 2. Authentication

- JWT Bearer tokens
- Signed with JWT_SECRET
- Token contains:
  - userId
  - role
  - companyId

Token lifetime:
- Short-lived access tokens (future: refresh tokens)

---

## 3. Role-based Access

Roles:
- ADMIN
- DISPATCHER
- TECHNICIAN
- CLIENT
- NETWORK_DIRECTOR

Rules:
- Only ADMIN/DISPATCHER create tickets
- Only ADMIN toggles auto-assign
- Only TECHNICIAN assigned can change status (future enforcement)

---

## 4. Secret Management

Secrets stored only in:
- .env
- docker-compose env
- production secret manager (future)

Never:
- Hardcode secrets
- Commit secrets
- Share production secrets

---

## 5. Future Security Enhancements

- Refresh tokens
- Rate limiting
- API throttling
- Audit log table
- IP restrictions
- Company-level API keys
