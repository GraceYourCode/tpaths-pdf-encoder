# TPaths Admin

The Next.js admin console for TPaths, connected to the NestJS backend through a server-side Backend-for-Frontend (BFF) layer. The browser never talks to the backend directly, and the backend is the only authorization boundary.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The admin app runs on port `3001` and expects the backend API on port `3000` by default.

## Environment

`API_BASE_URL` is server-only and must include the backend version prefix:

```env
API_BASE_URL=http://localhost:3000/api/v1
```

Session cookies are also server-only. Do not put backend, database, JWT, storage, or payment secrets in `NEXT_PUBLIC_*` variables.

## Authentication and session flow

1. The login Server Action posts credentials to `POST /auth/login`.
2. The backend verifies credentials and returns access/refresh tokens plus the authenticated user.
3. The frontend rejects non-admin accounts and stores the backend-issued tokens in `httpOnly`, `sameSite=lax` cookies.
4. Protected server requests attach the access token as a Bearer token.
5. The Next.js proxy (`proxy.ts`) refreshes an access token whose `exp` has passed, using `POST /auth/refresh`, when a refresh cookie is available. The expiry check lives in `lib/jwt.ts`.
6. `requireSession()` verifies the current account through `GET /auth/me` and requires `ADMIN` or `SUPER_ADMIN`. A 401 or 403 redirects to `/login`.
7. Logout calls `POST /auth/logout` best-effort and clears local cookies regardless of the backend response.

The browser never receives or reads the JWT or refresh token. Authorization is never decided from decoded claims.

## API integration architecture

```text
Pages / Server Actions
    ↓
lib/api/*  (server wrappers: products, students, tokens, finance, …)
    ↓
lib/api/types.ts, token-model.ts  (pure: DTO building, enum + money mapping)
    ↓
lib/api/server.ts → lib/api/client.ts
    ↓
NestJS backend /api/v1
```

Pure modules (`lib/money.ts`, `lib/jwt.ts`, `lib/api/types.ts`, `lib/api/errors.ts`, `lib/api/token-model.ts`, `lib/products/form.ts`, `lib/products/upload.ts`) import nothing from Next or React, so they can be unit-tested with `node --test`.

## Screens

| Route | Purpose | Backend routes |
|---|---|---|
| `/` | Dashboard counts and recent activity | `GET /admin/dashboard` |
| `/products`, `/products/new`, `/products/[id]` | Catalogue: title, course, institution, level, **price (₦)**, status; archive | `GET/POST /admin/products`, `GET/PATCH/DELETE /admin/products/:id` |
| `/products/[id]` (documents) | Upload PDF versions, see lifecycle state, remove | `POST /admin/products/:id/documents`, `PATCH/DELETE /admin/documents/:id` |
| `/tokens` | Generate and revoke activation tokens | `GET/POST /admin/tokens`, `POST /admin/tokens/:id/revoke` |
| `/students`, `/students/[id]` | Student list, status changes, purchases, licenses, devices | `GET /admin/students[/:id]`, `PATCH /admin/students/:id/status` |
| `/purchases` | Every purchase with its payment, license and student | `GET /admin/purchases` |
| `/payments` | Payment references and outcomes (ledger view over purchases) | `GET /admin/purchases` |
| `/licenses`, `/licenses/[id]` | License list, detail, suspend and revoke | `GET /admin/licenses[/:id]`, `POST /admin/licenses/:id/suspend\|revoke` |
| `/audit-logs` | Recorded admin and security events (read-only) | `GET /admin/audit-logs` |

Device revocation is available from a student's page. It calls an admin route that the backend does not implement yet; until it exists the screen shows "Backend endpoint not available". See `docs/backend-integration-gaps.md`.

## Product pricing

Prices are stored by the backend as integer **kobo**. The form takes naira (`2500` or `2,500.50`), converts it with `lib/money.ts`, and always sends `currency: "NGN"`. A product with no price (`0`, from before pricing existed) shows "Not set", and the backend refuses to make it `ACTIVE` until it has a positive price.

## Document (PDF) handling

- PDFs are submitted to a Server Action, then forwarded as `multipart/form-data` with exactly two fields, `file` and `title`. The browser never uploads to storage and never receives a PDF or storage URL.
- The admin never sends a document `status`. The backend owns the lifecycle, which is `PROCESSING → READY`, with `DISABLED`, `DELETED` and `FAILED` as the other states.
- Uploading a new version retires older `READY` versions, so students only reach the newest. If retiring one fails, the screen says which one, rather than hiding it.
- Removing a PDF calls `DELETE /admin/documents/:id`. The backend disables that version and keeps the record for audit.
- The client enforces the 25 MB limit and a PDF MIME type. The backend re-checks MIME, `%PDF-` magic bytes and size.

## Honest gaps

Some backend routes return data the screens cannot filter or page. Those screens say so instead of pretending. The full list, with the exact backend change needed for each, is in `docs/backend-integration-gaps.md`.

## Tests

```bash
npm test          # node --experimental-strip-types --test on **/*.test.ts
npm run typecheck
npm run lint
npm run build
```

The unit suite covers money conversion, product form parsing, the PDF upload contract (no `status` field), JWT expiry, token filtering and paging, backend-to-UI mapping, error classification, and navigation. Integration tests against a running backend are not included in this repository yet; see the test notes in `docs/backend-integration.md`.
