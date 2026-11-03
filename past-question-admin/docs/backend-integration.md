# Admin ↔ Backend Integration

This is the map from admin code to the NestJS backend routes, based on `past-question-backend/src` and `prisma/schema.prisma`. Where the backend contract is incomplete, the admin code says so; `docs/backend-integration-gaps.md` lists each gap and the backend change that closes it.

## Request path

```text
Admin page / Server Action
  ↓
lib/api/<domain>.ts          (server-only wrappers)
  ↓
lib/api/server.ts            (reads the httpOnly access-token cookie)
  ↓
lib/api/client.ts            (fetch, envelope handling, error mapping)
  ↓
/api/v1 NestJS backend
```

The browser never calls the backend. Access and refresh tokens stay in `httpOnly` cookies.

Pure logic that does not need Next or React lives beside these wrappers and is unit tested:

| Concern | Module |
|---|---|
| Backend ↔ UI enum and shape mapping, DTO body building | `lib/api/types.ts` |
| Token filtering and paging | `lib/api/token-model.ts` |
| Naira ↔ kobo | `lib/money.ts` |
| Product form parsing | `lib/products/form.ts` |
| PDF upload pre-check and multipart payload | `lib/products/upload.ts` |
| JWT `exp` check for refresh | `lib/jwt.ts` |
| HTTP error → typed `ApiError` → user copy | `lib/api/errors.ts` |

## Authentication

| Admin operation | Backend route | Notes |
|---|---|---|
| Login | `POST /auth/login` | Rejects non-admin users with 403 in the UI. |
| Current identity | `GET /auth/me` | Verifies the session and admin role on every protected render. |
| Refresh | `POST /auth/refresh` | Body `{ token }`. Used by `proxy.ts` only when `exp` has passed. |
| Logout | `POST /auth/logout` | Best-effort; local cookies are cleared either way. |

## Routes consumed, by screen

### Dashboard
- `GET /admin/dashboard`

### Products
| Action | Route | Body / query and mapping |
|---|---|---|
| List | `GET /admin/products` | `page`, `limit`, `search`, `status` (`DRAFT`/`ACTIVE`/`ARCHIVED`) |
| Detail | `GET /admin/products/:id` | Returns `documents` (all versions). |
| Create | `POST /admin/products` | `title`, `description?`, `course?`, `institution?`, `level?`, `status`, **`price` (kobo, integer ≥ 1, required)**, `currency` (≤ 3 chars). |
| Update | `PATCH /admin/products/:id` | Same fields, all optional. `ACTIVE` requires a positive price. |
| Archive | `DELETE /admin/products/:id` | Soft archive to `ARCHIVED`. There is no hard delete. |

The backend uses `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`. Any unknown key is a 400, so `lib/api/types.ts` maps every field explicitly (`toBackendProductBody`).

### Documents
| Action | Route | Notes |
|---|---|---|
| Upload | `POST /admin/products/:productId/documents` | Multipart with `file` (PDF, ≤ 25 MiB) and `title` only. Returns the document with the lifecycle status the backend assigned. |
| Retire a version | `PATCH /admin/documents/:id` | Body `{ title, status: "DISABLED" }`. `title` is currently required by the backend DTO. |
| Remove | `DELETE /admin/documents/:id` | The backend sets `DISABLED`, not `DELETED`. |

Document status values, from the Prisma enum: `PROCESSING`, `READY`, `DISABLED`, `DELETED`, `FAILED`. The UI renders all five. Students can read only a `READY` document.

### Access tokens
| Action | Route | Notes |
|---|---|---|
| List | `GET /admin/tokens` | No paging, status or product filter on the backend. The UI fetches up to 100 rows, filters and pages them, and shows a notice when the cap is reached. |
| Generate | `POST /admin/tokens` | One token per request, body `{ productId, expiresAt? }`. The plaintext code is returned once and never stored. |
| Revoke | `POST /admin/tokens/:id/revoke` | |

The backend never returns plaintext codes from list calls. The UI shows a non-secret mask derived from the id.

### Students
| Action | Route | Notes |
|---|---|---|
| List | `GET /admin/students` | `page`, `limit`, `search`, `status` (`ACTIVE`/`SUSPENDED`/`PENDING`). |
| Detail | `GET /admin/students/:id` | Returns `purchases`, `licenses` and `devices`. **Currently 404 — see gaps.** |
| Status change | `PATCH /admin/students/:id/status` | **Currently fails for the same reason — see gaps.** |
| Revoke a device | `POST /admin/devices/:id/revoke` | **Route does not exist yet.** The only device revoke on the backend is `POST /devices/:id/revoke`, which requires the device owner's session. |

### Purchases and payments
| Screen | Route | Notes |
|---|---|---|
| Purchases | `GET /admin/purchases?page&limit` | Returns a bare array with no total, so the UI uses prev/next. Each row includes its student, product, payment and licence. |
| Payments | `GET /admin/purchases` | The backend has no admin payments endpoint. The screen is a ledger over each purchase's embedded payment record. |

### Licenses
| Action | Route | Notes |
|---|---|---|
| List | `GET /admin/licenses` | Paging and filter params are accepted by the client, but the backend currently ignores them. The UI shows a notice when a response does not match the request. |
| Detail | `GET /admin/licenses/:id` | |
| Suspend | `POST /admin/licenses/:id/suspend` | Reversible on the backend. |
| Revoke | `POST /admin/licenses/:id/revoke` | Terminal. |

### Audit log
- `GET /admin/audit-logs?limit` (max 100). Bare array, no filters.

## Error handling

`lib/api/client.ts` accepts the backend's `{ success, data }` envelope or a bare JSON body.

| HTTP status | `ApiError.kind` | Copy shown |
|---|---|---|
| 400, 422 | `validation` | The backend message when present. |
| 413 | `validation` | "The file is too large. The maximum upload size is 25 MB." |
| 415 | `validation` | "That file type is not supported. Upload a PDF." |
| 401 | `unauthorized` | Session expired. |
| 403 | `forbidden` | Not authorized. |
| 404 | `not_found` | Not found. |
| 409 | `conflict` | Conflict. |
| 429 | `rate_limited` | Too many requests. |
| 501 | `not_implemented` | Backend endpoint not available. |
| 5xx | `server` | Backend error. |
| network failure | `network` | Cannot reach the backend. |

Stack traces and secrets are never shown. Backend 5xx messages are replaced with generic copy.

## Session expiry

1. `proxy.ts` reads the access token's `exp` (`lib/jwt.ts`). If it has passed and a refresh cookie exists, it calls `/auth/refresh` and rotates both cookies. A token that cannot be read is not refreshed locally; the backend answers 401.
2. `requireSession()` calls `/auth/me` on every protected page and Server Action. A 401 or 403 redirects to `/login`.
3. Logout calls the backend best-effort and always clears the cookies.

## Test status

| Area | How it is verified here | Still needed |
|---|---|---|
| Money, form parsing, upload payload, JWT expiry, token paging, error mapping, DTO body, enum mapping, navigation | `node --test` unit tests (see `README.md`) | Run in CI with `npm test`. |
| TypeScript | Pure modules type-check under `strict`. The full project needs `npm install`. | `npm run typecheck`, `npm run lint`, `npm run build`. |
| Product create/update/archive against a live backend | Not run here (no backend or database in the environment). | Manual checklist below. |
| PDF upload against a live backend | Not run here. | Manual checklist below. |

### Manual integration checklist (against a running backend and PostgreSQL)

1. **Create product.** Enter a title and price `2500`. Expect the request body to contain `price: 250000`, `currency: "NGN"`, and no `priceKobo`. Expect a redirect to the product page showing ₦2,500.00.
2. **Edit price.** Change the price to `0`. Expect the field error and no request. Enter `1,200.50`. Expect `price: 120050`.
3. **Publish without a price.** Create a DRAFT with price `0` through the API. Set status to published. Expect a 400 that the UI shows as "An ACTIVE product must have a positive price".
4. **Upload.** Upload a small PDF. Expect "Uploaded … It is ready for students." and a `READY` badge. The request must contain no `status` field.
5. **Upload a non-PDF** renamed to `.pdf`. Expect the backend 400 "Invalid PDF file" shown as-is.
6. **Upload over 25 MB.** Expect the client message before any request, or the 413 copy if the request is sent.
7. **Replace.** Upload a second PDF. Expect the first version to become `DISABLED`, and a notice if that step fails.
8. **Remove.** Remove the PDF. Expect `DISABLED` and that the product page refreshes.
9. **Archive.** Archive a product. Expect `ARCHIVED` and a redirect to `/products`.
10. **Session expiry.** Let the access token expire. Load a protected page. Expect a silent refresh. Then clear the refresh cookie and expire again. Expect `/login`.
11. **Logout.** Expect `/login`, and every admin route to redirect afterwards.
12. **Student role.** Log in with a STUDENT account through the API. Expect a 403 rejected before any cookie is set.
13. **Error states.** Stop the backend and load each list page. Expect "Cannot reach the backend" with a retry, not a crash.
