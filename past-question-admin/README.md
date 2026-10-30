# TPaths Admin

The existing Next.js admin dashboard is connected to the implemented NestJS backend through a server-side Backend-for-Frontend (BFF) layer. The UI/design is intentionally preserved; integration changes are limited to API mapping, authentication/session handling, mutations, document upload, and honest error states.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The admin app runs on port `3001` and expects the backend API on port `3000` by default.

## Environment

`API_BASE_URL` is server-only and should include the backend version prefix:

```env
API_BASE_URL=http://localhost:3000/api/v1
```

Session cookies are also server-only. Do not put backend, database, JWT, storage, or payment secrets in `NEXT_PUBLIC_*` variables.

## Backend dependency

The backend must be running and its PostgreSQL/storage dependencies must be healthy. This frontend consumes the routes actually implemented by the backend; it does not create mock endpoints or client-side authorization.

## Authentication and session flow

1. The login Server Action posts credentials to `POST /auth/login`.
2. The backend verifies credentials and returns access/refresh tokens plus the authenticated user.
3. The frontend rejects non-admin accounts and stores the backend-issued tokens in `httpOnly`, `sameSite=lax` cookies.
4. Protected server requests attach the access token as a Bearer token.
5. The Next.js proxy refreshes an expired access token with `POST /auth/refresh` when a refresh cookie is available.
6. `requireSession()` also verifies the current account through `GET /auth/me` and requires `ADMIN` or `SUPER_ADMIN`.
7. Logout calls `POST /auth/logout` best-effort and clears local cookies regardless of backend response.

The browser never receives or reads the JWT/refresh token.

## API integration architecture

```text
Existing UI
    ↓
Server Actions / Server Components
    ↓
lib/api/* domain services
    ↓
lib/api/server.ts + lib/api/client.ts
    ↓
NestJS backend /api/v1
    ↓
PostgreSQL / private storage
```

Response adapters in `lib/api/types.ts` translate the backend's uppercase enums and database-oriented shapes into the existing UI models. Backend errors are converted into safe `ApiError` instances.

## Connected features

- Admin authentication, role enforcement, logout, and refresh
- Dashboard aggregates
- Product list/search/filter/pagination
- Product creation and editing using the backend's actual fields
- Product archival through the backend's `DELETE /admin/products/:id` lifecycle operation
- Private PDF upload and document removal
- Student list/search/filter/pagination and status changes
- Activation-token listing, generation, filtering, and revocation

Licenses, purchases, and devices have backend endpoints, but the supplied admin frontend contains no dedicated screens for them, so no unnecessary UI was added.

## PDF handling

PDFs are submitted to a Next.js Server Action, then forwarded as `multipart/form-data` to the backend. The browser never uploads directly to storage. The frontend enforces the backend's 25 MB limit and sends the required document title/status fields. The backend remains responsible for MIME, magic-byte, size, storage, and authorization checks.

## Backend integration gaps

The implemented backend differs from the original frontend's earlier contract in several places. The integration adapts these where possible and does not invent data:

- Product price and exam year are not fields in the backend `Product` model, so the unsupported price/year form fields are not submitted.
- Product `course` is mapped to the UI's `courseCode` display model.
- The backend document response has no page count or public reference; the UI displays available document metadata without fabricating those values.
- The backend token endpoint creates one token per request and does not support student-email assignment. The existing quantity control is implemented as repeated real backend calls; assignment is shown from the backend's purchase linkage when available.
- The backend token list does not return plaintext token values. The UI therefore displays a non-secret identifier mask, never a fabricated token code.
- The backend student list does not provide a reliable `lastActiveAt`; the UI leaves that value empty rather than deriving a misleading timestamp.

These are backend contract limitations, not frontend mock implementations.

## Validation

Run the project's actual validation scripts in an environment with dependencies installed:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
