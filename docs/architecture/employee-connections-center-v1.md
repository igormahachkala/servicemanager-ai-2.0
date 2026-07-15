# Employee Connections Center V1

> **Task:** AI-COMPANY-115  
> **Status:** implemented (DEV-only)  
> **Module:** `apps/ai-company/src/domain/employeeConnections/`

---

## 1. Product purpose

Central subsystem for connecting digital employees to external and local services without manual `.env` editing.

Owner workflow:
1. Open employee profile → **Connections**
2. Pick service from catalog
3. Configure auth/settings
4. Grant capabilities
5. Verify connection
6. Employee uses capability via Tool Dispatcher / runtime resolver

---

## 2. Domain model

| Entity | Purpose |
|--------|---------|
| `ConnectionProviderDefinition` | Catalog entry (GitHub, Cursor, Ollama, …) |
| `CompanyConnection` | Company-owned connection instance (no raw secrets) |
| `EmployeeConnectionGrant` | Capability grant for a specific employee |
| `ConnectionCapabilityDefinition` | Fine-grained permission IDs |

---

## 3. Provider catalog

10 providers in V1 catalog. Implemented adapters:
- GitHub (local/git)
- Cursor Automations (webhook + secret)
- Ollama (endpoint health)

Others: catalog + honest `AUTH_REQUIRED` / `NOT_CONFIGURED` — no fake connected.

---

## 4. Connection ownership

Connections belong to **AI Company** (company scope). Grants assign access to employees.

---

## 5. Employee grants

Separate from connection creation:
- `capabilityIds[]`
- `permissionLevel`
- `requiresOwnerApproval`
- `allowedEnvironments`
- `spendingPolicy`

---

## 6. Capabilities

Examples: `github.repository.read`, `cursor.automation.dispatch`, `ollama.inference.run`, …

Tool Dispatcher V1 integration: `preflightEmployeeCapability()` helper.

---

## 7. Authentication methods

OAuth architecture boundary for Google/GitHub/Figma (V1: status only).  
Token/webhook secrets via trusted bridge.  
Local runtime for Ollama/Git.

---

## 8. Secret storage

`ConnectionSecretStore` in `tools/connections-bridge/` (in-memory DEV V1).

Rules:
- No secrets in `CompanyConnection.configuration`
- No secrets in browser localStorage
- No secrets in prompts/logs/ToolExecutionRun output
- UI shows mask only (`••••••••abcd`)

---

## 9. Health checks

`testConnection()` via bridge:
- **Ollama:** `/api/tags`, list models
- **Cursor:** URL format + secret presence (no auto-dispatch)
- **GitHub local:** origin match + branch listing

Saving config ≠ connected.

---

## 10. Runtime resolver

`resolveEmployeeCapability({ employeeId, capabilityId, environment })`

Reason codes: `CONNECTION_AVAILABLE`, `CAPABILITY_NOT_GRANTED`, `AUTH_REQUIRED`, `COST_UNKNOWN`, …

---

## 11. Tool Dispatcher integration

`connectionRuntimeIntegration.ts`:
- `preflightEmployeeCapability()`
- `resolveCursorAutomationConnectionForEmployee()`
- `resolveOllamaConnectionForEmployee()`

Legacy env fallback preserved for DEV migration.

---

## 12. Cost Guard

Connection `costClassification` + grant `spendingPolicy` enforced in resolver.

No automatic credits purchase or Max Mode toggle.

---

## 13. Environment separation

`DEV | STAGE | PRODUCTION` on connections and grants.

---

## 14. Audit

Events: `connection_created`, `employee_connection_granted`, `connection_verified`, `capability_resolution_blocked`, …

No raw secrets in audit metadata.

---

## 15. UI flow

Route: `/mobile/employees/:id/connections`

Mobile-first cards, category filters, step setup for Cursor/GitHub/Ollama.

---

## 16. Provider-specific behavior

See provider catalog in `connectionProviderCatalog.ts`.

---

## 17. Legacy env migration

`detectLegacyRuntimeConnections()` surfaces Cursor webhook, GitHub evidence, Ollama settings hints without exposing secrets.

---

## 18. Security model

Trusted bridge on `127.0.0.1:17321`, proxied as `/runtime/connections`.

---

## 19. Known gaps

- OAuth exchange not implemented (honest AUTH_REQUIRED)
- Ephemeral in-memory secrets until bridge restart
- Gmail/Calendar/Drive/Figma/n8n/SMA/MAX adapters not wired
- Production secret vault out of scope

---

## 20. Stage readiness

Architecture supports Stage with persistent secret store + OAuth backend. DEV-only in V1.

---

## 21. Future providers

Extend `CONNECTION_PROVIDER_CATALOG` + bridge health adapter + grant defaults.

---

## Local acceptance

```bash
npm --prefix apps/ai-company run connections:bridge
npm --prefix apps/ai-company run github:evidence
npm --prefix apps/ai-company run dev
```

Open Builder → Connections → add Cursor, GitHub, Ollama → verify → run autonomous Builder task.
