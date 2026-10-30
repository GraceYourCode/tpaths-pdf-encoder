# Security test matrix

The automated test suite covers authentication failures, RBAC, ownership/IDOR, token replay/revocation/expiry, license and device authorization, payment/webhook signature validation, malformed input, rate limiting, and secure content authorization. Database-backed E2E scenarios require a PostgreSQL test database configured through `DATABASE_URL`.

| Area | Scenario | Expected |
|---|---|---|
| Authentication | Invalid credentials | 401, generic response |
| Authentication | Repeated login attempts | 429 after configured threshold |
| Authorization | Student -> admin route | 403 |
| Authorization | User A -> User B resource | 403/404 |
| Tokens | Invalid/revoked/expired activation token | rejected |
| Tokens | Same token concurrently | one binding only |
| Licenses | Revoked/expired license | content denied |
| Devices | Different user's device | denied |
| Content | Missing entitlement | denied |
| Payments | Client claims success | backend independently verifies |
| Webhooks | Invalid signature | 401 |
| Webhooks | Duplicate event | idempotent |
| Input | Unknown DTO field | 400 |
| Input | Oversized body/upload | rejected |
| Files | Non-PDF / invalid magic | rejected |
| Sessions | Revoked refresh token | 401 |
| Sessions | Refresh-token reuse | family revoked, 401 |
| Admin | Privileged operation | role checked and audited |
