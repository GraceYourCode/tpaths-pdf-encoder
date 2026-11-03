# TPATHS API Contract

This is the single authoritative description of the backend HTTP API used by
the mobile app, the web app and the admin app. When this document and the code
disagree, the code is wrong and this document must be corrected in the same
change. The route list is also exposed at `GET /api/v1/openapi/json`.

- Base path: `/api/v1`
- Content type: `application/json` unless stated otherwise
- Authentication: `Authorization: Bearer <access token>` unless marked *public*
- Error envelope: see [Errors](#errors)

## Conventions

- Identifiers are UUID strings.
- Money amounts are integers in the currency's smallest unit (kobo for NGN).
- Timestamps are ISO 8601 UTC strings.
- Admin routes require role `ADMIN` or `SUPER_ADMIN`.

## Errors

Errors use the global exception filter. A status code is always set; the body
never contains stack traces, SQL, or secrets.

| Status | Meaning |
| ------ | ------- |
| 400 | Validation failed or request not acceptable |
| 401 | Missing, invalid or expired credentials / tokens |
| 403 | Authenticated but not permitted (inactive account, wrong device, revoked licence, unverified email) |
| 404 | Resource not found (also used to avoid confirming a resource exists to another user) |
| 409 | Conflict (duplicate email, licence already bound, device key replacement) |
| 429 | Rate limit exceeded; `Retry-After` header is set |
| 503 | Dependency unavailable (database, object storage, rate-limit store) |

In production, the verification, resend and password-reset endpoints return the
same response whether or not the account exists. Outside production the
development token is returned, so do not rely on that uniformity in dev.

Machine-readable reasons for 403 responses on login:

- `EMAIL_NOT_VERIFIED`: password was correct but the email is not verified.
- `ACCOUNT_INACTIVE`: password was correct but the account is suspended or pending.

## Health

| Method | Path | Auth | Response |
| ------ | ---- | ---- | -------- |
| GET | `/health` | public | `{ status: "ok", uptime, timestamp }` |
| GET | `/health/db` | public | `{ status, database: "up"\|"down", timestamp }` |
| GET | `/health/ready` | public | `{ status, database, storage, timestamp }`; **503** when any dependency is down |

## Auth

| Method | Path | Auth | Request | Response |
| ------ | ---- | ---- | ------- | -------- |
| POST | `/auth/register` | public | `{ email, password, firstName, lastName, whatsapp }` | `201` `{ user }` (plus `verificationToken` outside production only). **409** if email exists |
| POST | `/auth/login` | public | `{ email, password }` | `200` `{ accessToken, refreshToken, user }`. **403** `EMAIL_NOT_VERIFIED` / `ACCOUNT_INACTIVE` |
| POST | `/auth/refresh` | public | `{ token }` (refresh token) | `200` `{ accessToken, refreshToken }`. Reuse of a rotated token revokes the session family |
| POST | `/auth/logout` | bearer | — | `{ loggedOut: true }` |
| POST | `/auth/logout-all` | bearer | — | `{ loggedOut: true }` |
| GET | `/auth/me` | bearer | — | `{ id, email, firstName, lastName, role, status, emailVerifiedAt, createdAt, updatedAt }` |
| POST | `/auth/verify-email` | public | `{ token }` | `{ verified: true }`. **401** if invalid, used or expired |
| POST | `/auth/resend-verification` | public | `{ email }` | `{ sent: true }` (uniform in production) |
| POST | `/auth/forgot-password` | public | `{ email }` | `{ sent: true }` (uniform in production) |
| POST | `/auth/reset-password` | public | `{ token, password }` | `{ reset: true }`. Revokes all sessions |

Access tokens last 15 minutes by default (`JWT_ACCESS_EXPIRATION_SEC`).
Refresh tokens last 30 days by default (`JWT_REFRESH_EXPIRATION_MS`).

## Users

| Method | Path | Auth | Response |
| ------ | ---- | ---- | -------- |
| GET | `/users/me` | bearer | Profile |
| PATCH | `/users/me` | bearer | Updated profile |
| GET | `/users/me/licenses` | bearer | Licences with product summary |
| GET | `/users/me/purchases` | bearer | Purchases |
| GET | `/users/me/devices` | bearer | Devices |

## Products

| Method | Path | Auth | Response |
| ------ | ---- | ---- | -------- |
| GET | `/products` | public | Active products only |
| GET | `/products/{id}` | public | Active product only; **404** otherwise |

## Devices

Device identity is the backend-issued device ID. Clients must persist the `id`
returned by registration and use it for every later device-scoped call.

| Method | Path | Auth | Request | Response |
| ------ | ---- | ---- | ------- | -------- |
| POST | `/devices/register` | bearer | `{ deviceId, platform, appVersion?, publicKey? }` | `{ id, platform, appVersion, status, lastSeenAt, createdAt, publicKeyRegistered, publicKeyError? }` |
| GET | `/devices` | bearer | — | Devices owned by the caller |
| POST | `/devices/{id}/validate` | bearer | — | `{ valid: true }` or **403** |
| POST | `/devices/{id}/revoke` | bearer | — | `{ revoked: true }` |

`deviceId` is the client-side installation identifier used for the device hash.
`publicKey` is base64-encoded DER `SubjectPublicKeyInfo` for a **P-256** key
(91 bytes). Keys that fail validation are not stored; the response reports
`publicKeyRegistered: false` and `publicKeyError`, and registration still
succeeds. A registered key cannot be replaced by a different key; the device
must be revoked first (**409**).

## Licences

| Method | Path | Auth | Request | Response |
| ------ | ---- | ---- | ------- | -------- |
| POST | `/licenses/activate` | bearer | `{ token, deviceId }` | Licence bound to the device. **409** if bound to another device; **403** for an invalid token |
| GET | `/licenses` | bearer | — | Caller's licences |
| GET | `/licenses/{id}` | bearer | — | Licence with product and active documents. **404** if not the caller's |
| POST | `/licenses/{id}/validate` | bearer | `{ deviceId? }` | `{ valid, licenseId?, expiresAt? }` |

Activation tokens are single-use and expire where `expiresAt` is set. Tokens
created by a completed payment are bound to that purchase.

## Content (protected documents)

| Method | Path | Auth | Request | Response |
| ------ | ---- | ---- | ------- | -------- |
| POST | `/content/{documentId}/access` | bearer | `{ deviceId }` | `{ authorizationToken, expiresAt, document: { id, title, version, mimeType, sizeBytes, checksumSha256 }, artifactEndpoint }` |
| GET | `/content/{documentId}/artifact` | **content token** | header `X-Content-Authorization: <authorizationToken>` | Binary `.pqe` artifact (see below) |

Authorization token: a signed JWT, valid for `CONTENT_AUTHORIZATION_TTL_MS`
(default 5 minutes). It is bound to the user, document, device, licence, session
and a unique token ID. It is re-verified against the database on every artifact
request.

Artifact response headers:

- `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; filename="<sanitised title>.pqe"`
- `Cache-Control: no-store, no-cache, must-revalidate, private`
- `Pragma: no-cache`
- `X-Content-Type-Options: nosniff`
- `Content-Length`

The body is the TPQE v1 format defined in `docs/pqe-artifact-protocol.md`. The
original PDF is never returned by any route.

Artifact requests are rejected when any of these hold: token invalid or expired;
document mismatch; licence missing, inactive, expired or bound to another
device; purchase not paid; product inactive; document not `READY`; device not
`ACTIVE`, not owned by the caller, or without a registered key; session revoked
or expired; user not `ACTIVE`; stored document fails integrity verification
(logged as `DOCUMENT_INTEGRITY_FAILURE`, returned as 500 without detail).

## Payments

| Method | Path | Auth | Request | Response |
| ------ | ---- | ---- | ------- | -------- |
| POST | `/payments/initialize` | bearer | `{ productId }` | `{ reference, authorizationUrl, accessCode }`. The amount and customer e-mail are set by the server. **409** if already owned |
| POST | `/payments/verify` | bearer | `{ reference, productId?, amount? }` | Purchase summary with `status`, `license`, and `activationToken` the first time it completes. **403** if the purchase belongs to another user |
| POST | `/payments/webhook` | *public, signed* | Paystack event JSON | `{ processed: true, duplicate?, ignored? }`. Signature is `x-paystack-signature` = HMAC-SHA512 of the raw body |

Completion is idempotent. The server re-checks the transaction with Paystack,
compares the amount and currency with the stored purchase, and atomically moves
the purchase from `PENDING` or `FAILED` to `PAID`. Repeat calls and duplicate
webhook events return the existing result without creating a second licence or
activation token.

## Admin

All admin routes require `ADMIN` or `SUPER_ADMIN`.

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/admin/dashboard` | Summary counts |
| GET | `/admin/students` | Supports query filters (see controller) |
| GET | `/admin/students/{id}` | Student detail |
| PATCH | `/admin/students/{id}/status` | Status change |
| GET | `/admin/students/{id}/licenses` | |
| GET | `/admin/students/{id}/purchases` | |
| GET | `/admin/students/{id}/devices` | |
| GET | `/admin/audit-logs` | Supports query filters (see controller) |
| GET, POST | `/admin/tokens` | List and create activation tokens |
| GET | `/admin/tokens/{id}` | |
| POST | `/admin/tokens/{id}/suspend` | |
| POST | `/admin/tokens/{id}/revoke` | |
| GET, POST | `/admin/products` | List and create products |
| GET, PATCH, DELETE | `/admin/products/{id}` | |
| POST | `/admin/products/{id}/archive` | |
| GET, POST | `/admin/products/{productId}/documents` | POST: multipart `file` (PDF, 25 MB max) and `title`. Stored encrypted at rest; status `READY` on success |
| GET, PATCH, DELETE | `/admin/products/{productId}/documents/{id}` | PATCH `status` accepts `READY`, `DISABLED`, `DELETED`. DELETE disables |
| GET | `/admin/licenses` | |
| GET | `/admin/licenses/{id}` | |
| POST | `/admin/licenses/{id}/suspend` | |
| POST | `/admin/licenses/{id}/revoke` | |
| GET | `/admin/purchases` | |
| GET | `/admin/purchases/{id}` | |

## Document status values

Prisma `DocumentStatus`: `PROCESSING`, `READY`, `DISABLED`, `DELETED`, `FAILED`.
Only `READY` documents are visible to students and deliverable as artifacts.

## Rate limits

Global default: `THROTTLE_LIMIT` requests per `THROTTLE_TTL_MS` per client IP.
Stricter per-route limits apply to registration, login, token refresh, email
verification, password reset, licence activation, content access and artifact
download. Counters are shared through PostgreSQL in production.
