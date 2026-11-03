> **Superseded.** This Phase 3 contract predates the implemented backend and uses routes
> (for example `/admin/auth/login`) that do not exist. The current route map is in
> [`backend-integration.md`](backend-integration.md), and the open backend gaps are in
> [`backend-integration-gaps.md`](backend-integration-gaps.md).

# Backend Requirements — Admin Dashboard (Phase 3)

This document is the contract the **Phase 2 backend** (`past-question-backend`)
must fulfil for the Phase 3 **admin dashboard** (`past-question-admin`) to be
fully functional.

> **Status:** As of this writing the backend exposes only `/`, `/health`, and
> `/health/db`. **None** of the admin endpoints below are implemented yet.
> The admin app is wired to call these exact routes and **fails honestly** (an
> error state in the UI) until they exist. Nothing in the frontend is faked,
> stubbed, or mocked to pretend an endpoint works. The TypeScript types in
> [`lib/api/types.ts`](../lib/api/types.ts) are the single source of truth for
> the shapes below.

---

## 1. Conventions

### Base path
All endpoints are versioned under **`/api/v1`** and namespaced under
**`/admin`**. The base URL is configured in the admin app via the server-only
`API_BASE_URL` environment variable (default `http://localhost:3000/api/v1`).

### Authentication
- Every endpoint **except** `POST /admin/auth/login` and
  `POST /admin/auth/refresh` requires a valid **admin** JWT.
- The token is sent in the `Authorization: Bearer <token>` header. The admin app
  holds this token in an **httpOnly cookie** and attaches it **server-side only**
  (see [`lib/api/server.ts`](../lib/api/server.ts)); it is never exposed to the
  browser.
- The backend **must** enforce that the token belongs to a user with an admin
  role (`admin` or `superadmin`). A student token must receive `403 Forbidden`.
  **The backend is the security boundary** — the dashboard's cookie/route checks
  are optimistic UX only.

### Response envelope
The client ([`lib/api/client.ts`](../lib/api/client.ts)) accepts **either** a
bare JSON body **or** this envelope, so the backend may use whichever is its
house style:

```jsonc
// success
{ "success": true, "data": { /* payload */ } }

// error
{
  "success": false,
  "error": { "code": "INVALID_CREDENTIALS", "message": "Human-readable text", "details": { } },
  "timestamp": "2026-09-04T12:00:00.000Z",
  "path": "/api/v1/admin/auth/login"
}
```

When enveloped, the admin app unwraps `data`. When not enveloped, a 2xx body is
used as-is and a non-2xx body is mapped to an error by status code.

### HTTP status → UI error mapping
| Status | UI treatment |
|--------|--------------|
| 400 / 422 | validation error (field-level where provided in `error.details`) |
| 401 | unauthorized — session treated as invalid |
| 403 | forbidden |
| 404 | not found (e.g. product detail renders a not-found page) |
| 409 | conflict |
| 429 | rate limited |
| 501 | "endpoint not available" (used while unimplemented) |
| 5xx | server error |

### Pagination
List endpoints return:

```jsonc
{ "items": [ /* T */ ], "total": 128, "page": 1, "pageSize": 20, "totalPages": 7 }
```

Query params: `page` (1-based), `pageSize`, plus endpoint-specific filters.

### Money
Prices are integer **minor units (NGN kobo)** in the field `priceKobo`. The
admin UI converts naira ↔ kobo for display and input. `currency` is an ISO code
(e.g. `"NGN"`).

---

## 2. Authentication

### `POST /api/v1/admin/auth/login`  *(unauthenticated)*
Relay admin credentials; backend owns all password verification and JWT minting.

- **Body:** `{ "email": string, "password": string }`
- **200:** `{ "accessToken": string, "refreshToken"?: string, "admin"?: AdminUser, "expiresIn"?: number }`
- **401:** invalid credentials

`AdminUser`: `{ "id": string, "email": string, "name"?: string, "role": "admin" | "superadmin" }`

### `GET /api/v1/admin/auth/me`  *(admin)*
Return the currently authenticated admin (used to verify/hydrate identity).
- **200:** `AdminUser`
- **401:** session invalid/expired

### `POST /api/v1/admin/auth/logout`  *(admin)*
Best-effort server-side token/session invalidation. The admin app clears its
local cookies regardless of the result.
- **200 / 204:** ok

### `POST /api/v1/admin/auth/refresh`  *(unauthenticated, refresh token in body)*
Exchange a refresh token for a new access token.
- **Body:** `{ "refreshToken": string }`
- **200:** `{ "accessToken": string, "refreshToken"?: string, "expiresIn"?: number }`

---

## 3. Dashboard

### `GET /api/v1/admin/stats`  *(admin)*
Aggregate counts for the overview page.
- **200:**
```jsonc
{
  "totalProducts": 42, "publishedProducts": 30, "draftProducts": 12,
  "totalStudents": 1280, "activeStudents": 1190,
  "activeTokens": 340, "redeemedTokens": 910
}
```

---

## 4. Products (past-question packs)

`Product`:
```jsonc
{
  "id": "string",
  "title": "string",
  "description": "string | null",
  "courseCode": "string | null",
  "institution": "string | null",
  "level": "string | null",
  "year": 2024,
  "priceKobo": 250000,
  "currency": "NGN",
  "status": "draft" | "published" | "archived",
  "hasDocument": true,
  "document": ProductDocumentMeta | null,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

`ProductInput` (create / update body):
```jsonc
{
  "title": "string",
  "description": "string | null",
  "courseCode": "string | null",
  "institution": "string | null",
  "level": "string | null",
  "year": 2024,
  "priceKobo": 250000,
  "status": "draft" | "published" | "archived"
}
```

### `GET /api/v1/admin/products?page&pageSize&search&status`  *(admin)*
- **200:** `Paginated<Product>`

### `GET /api/v1/admin/products/:id`  *(admin)*
- **200:** `Product` · **404:** not found

### `POST /api/v1/admin/products`  *(admin)*
- **Body:** `ProductInput` · **201:** `Product`

### `PATCH /api/v1/admin/products/:id`  *(admin)*
- **Body:** `Partial<ProductInput>` · **200:** `Product`

### `DELETE /api/v1/admin/products/:id`  *(admin)*
- **204:** deleted

### `POST /api/v1/admin/products/:id/document`  *(admin)* — **PDF upload**
- **Content-Type:** `multipart/form-data`, single field **`file`** (`application/pdf`)
- **200:** `ProductDocumentMeta` (opaque metadata **only**)

`ProductDocumentMeta`:
```jsonc
{
  "fileName": "mth101-2024.pdf",
  "sizeBytes": 1048576,
  "pageCount": 42,
  "uploadedAt": "ISO-8601",
  "reference": "opaque-storage-key-or-null"   // NEVER a public URL
}
```

### `DELETE /api/v1/admin/products/:id/document`  *(admin)*
- **204:** document removed

#### PDF security contract (must hold)
1. The PDF is uploaded **only** to the backend (streamed through a Next.js
   Server Action). The browser never uploads directly to S3/R2/any bucket.
2. The backend stores the file in **private** storage and returns **opaque**
   metadata. `reference` is an internal handle, **not** a downloadable link.
3. **No publicly accessible PDF URL is ever created or returned.** Student
   access to the actual file (Phase ≥ 4) must go through a separate, authorized,
   short-lived, backend-mediated delivery mechanism — never a public bucket URL.
4. The backend should validate content type and size (the admin UI pre-checks
   `application/pdf` and a 50 MB cap, but that check is advisory, not a boundary).

---

## 5. Access / license tokens

`AccessToken`:
```jsonc
{
  "id": "string",
  "maskedCode": "TPX-••••-9F3A",     // masked; full value returned only at creation
  "productId": "string | null",
  "productTitle": "string | null",
  "studentId": "string | null",
  "studentEmail": "string | null",
  "status": "active" | "redeemed" | "revoked" | "expired",
  "createdAt": "ISO-8601",
  "expiresAt": "ISO-8601 | null",
  "redeemedAt": "ISO-8601 | null"
}
```

### `GET /api/v1/admin/tokens?page&pageSize&status&productId&search`  *(admin)*
- **200:** `Paginated<AccessToken>` (codes returned **masked** only)

### `POST /api/v1/admin/tokens`  *(admin)* — generate
- **Body:**
```jsonc
{ "productId": "string", "quantity": 1, "studentEmail": "string | null", "expiresAt": "ISO-8601 | null" }
```
(`quantity` 1–500, enforced client-side; enforce server-side too.)
- **201:**
```jsonc
{ "tokens": [ AccessToken ], "plaintextCodes": [ "TPX-1A2B-9F3A", ... ] }
```
- **`plaintextCodes` is the only time full codes are returned.** They are shown
  once in the UI and never re-fetched. Store only hashes server-side.

### `POST /api/v1/admin/tokens/:id/revoke`  *(admin)*
- **200 / 204:** token set to `revoked`

---

## 6. Students

`Student`:
```jsonc
{
  "id": "string",
  "email": "string",
  "name": "string | null",
  "status": "active" | "suspended",
  "purchaseCount": 3,
  "createdAt": "ISO-8601",
  "lastActiveAt": "ISO-8601 | null"
}
```

### `GET /api/v1/admin/students?page&pageSize&search&status`  *(admin)*
- **200:** `Paginated<Student>`

### `GET /api/v1/admin/students/:id`  *(admin)*
- **200:** `Student` · **404:** not found

### `PATCH /api/v1/admin/students/:id/status`  *(admin)*
- **Body:** `{ "status": "active" | "suspended" }`
- **200:** updated `Student`
- Suspending a student must revoke their ability to access purchased packs.

---

## 7. Cross-cutting backend requirements

- **Role enforcement:** all `/admin/*` data endpoints must reject non-admin
  tokens with `403`. Never rely on the dashboard to hide admin functionality.
- **Never expose secrets:** responses must not include password hashes, raw
  tokens (beyond the one-time `plaintextCodes`), refresh tokens in list bodies,
  storage credentials, or internal secrets.
- **Audit logging (deferred):** admin mutations (product create/update/delete,
  document upload/delete, token generate/revoke, student suspend/reactivate)
  should be audit-logged **in the backend**. The admin app does **not** fake
  audit logging; when the backend implements it, no frontend change is required.
- **Rate limiting:** login and token generation should be rate-limited server-side.
