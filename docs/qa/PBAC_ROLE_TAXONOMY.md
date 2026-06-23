# PBAC Role Taxonomy Mapping (Freeze)

Дата фиксации: 2026-06-23  
Контекст: `SMA-PERM-FREEZE-001`

## Canonical mapping

- `CLIENT_ADMIN` = `ADMIN` в компании типа `CLIENT`.
- `PROVIDER_ADMIN` = `ADMIN` в компании типа `PROVIDER`.
- `CLIENT_USER` = `CLIENT`.
- `PROVIDER_MANAGER` = `MASTER` / `DISPATCHER` / `NETWORK_DIRECTOR` (до ввода отдельной роли).
- `MANAGER` отсутствует в `UserRole` enum, использовать нельзя без отдельного ADR и миграции.

## Notes

- Mapping не добавляет новые роли и не меняет enum.
- Mapping нужен для единообразия QA/документации/permission matrix.
- Все проверки доступа остаются через существующие `RolesGuard`/`PermissionsGuard`/policy-scope.
