# Past Questions — Backend

Backend API for a secure academic past-questions delivery platform.
The backend provides authentication (email verification, refresh rotation, sessions), users, products, Paystack payments (initialize, verify and signed webhook), licences and activation tokens, device registration with P-256 public keys, audit logging, encrypted-at-rest document storage (local disk for development, S3-compatible object storage for production), and entitlement-gated, device-bound artifact delivery in the TPQE v1 format. The authoritative API description is [docs/api-contract.md](docs/api-contract.md).

- **Runtime:** Node.js 20+, TypeScript (ESM, `nodenext`)
- **Framework:** NestJS 12
- **Database:** PostgreSQL via Prisma 7 (driver-adapter model). The client is
  generated into `src/generated/prisma` by `npm run prisma:generate`.
- **Tests:** Vitest 4 (unit + e2e)
- **Lint/format:** oxlint + Prettier

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file (never commit .env)
cp .env.example .env
# edit .env and set a real DATABASE_URL

# 3. Run in watch mode
npm run start:dev
```

The API is then served under the versioned prefix, e.g.
`http://localhost:3000/api/v1/health`.

---

## Configuration

Configuration is read exclusively through `@nestjs/config` (never
`process.env` directly in feature code). Environment variables are **validated
at boot** (`src/config/env.validation.ts`); the process fails fast with a clear
message if a required variable is missing or malformed.

| Variable          | Required | Default         | Description                                                        |
| ----------------- | -------- | --------------- | ------------------------------------------------------------------ |
| `NODE_ENV`        | no       | `development`   | `development` \| `test` \| `preview` \| `production`               |
| `PORT`            | no       | `3000`          | HTTP listen port                                                   |
| `DATABASE_URL`    | **yes**  | —               | PostgreSQL connection string consumed by Prisma                    |
| `API_PREFIX`      | no       | `api`           | Global route prefix                                                |
| `API_VERSION`     | no       | `1`             | Default URI API version                                            |
| `CORS_ORIGINS`    | no       | `*`             | Comma-separated allowlist, or `*` for all (development only)       |
| `THROTTLE_TTL_MS` | no       | `60000`         | Rate-limit window (ms)                                             |
| `THROTTLE_LIMIT`  | no       | `120`           | Max requests per window per client                                 |

See [`.env.example`](.env.example) for a copy-paste template. **Never commit
`.env` or real secrets.** In preview/production, set an explicit `CORS_ORIGINS`
allowlist rather than `*`.

---

## Scripts

| Script                    | What it does                                              |
| ------------------------- | -------------------------------------------------------- |
| `npm run start:dev`       | Start in watch mode                                      |
| `npm run start:prod`      | Run the compiled server (`dist/`)                        |
| `npm run build`           | Compile with the Nest CLI                                |
| `npm run typecheck`       | `tsc --noEmit`                                           |
| `npm run lint`            | oxlint over `src/` and `test/`                           |
| `npm run lint:fix`        | oxlint with autofix                                      |
| `npm run format`          | Prettier write                                           |
| `npm run format:check`    | Prettier check (used in CI)                              |
| `npm run test`            | Unit tests (Vitest)                                      |
| `npm run test:e2e`        | End-to-end tests (Vitest)                                |
| `npm run test:cov`        | Unit tests with coverage                                 |
| `npm run prisma:generate` | Generate the Prisma client                               |
| `npm run prisma:migrate`  | Create/apply a dev migration (`prisma migrate dev`)      |
| `npm run prisma:deploy`   | Apply migrations in CI/production (`migrate deploy`)     |

---

## Secure document system

Phase 5 document endpoints are documented in [`docs/document-api.md`](docs/document-api.md), with the security model in [`docs/document-security.md`](docs/document-security.md) and implementation details in [`docs/document-system.md`](docs/document-system.md).

The upload path validates PDF MIME type and magic bytes, creates a `PROCESSING` record, encrypts the PDF with AES-256-GCM using a per-document data key wrapped by the application encryption key, stores only the encrypted artifact, records plaintext/encrypted checksums, and marks the document `READY`. Admins can disable, delete, and retry failed processing records.

The content path issues a short-lived, document-scoped authorization token and rechecks session, device, license, purchase, product, and document state before returning the encrypted artifact. Storage credentials and encryption master keys are never returned to clients.

## API

All routes are served under `/{API_PREFIX}/v{API_VERSION}` (default `/api/v1`).

| Method | Path              | Description                                                     |
| ------ | ----------------- | -------------------------------------------------------------- |
| `GET`  | `/api/v1`         | Non-sensitive service descriptor (name, status, env, version)  |
| `GET`  | `/api/v1/health`  | Liveness: `{ status: "ok", uptime, timestamp }` (no DB touch)  |
| `GET`  | `/api/v1/health/db` | Readiness: reports whether PostgreSQL is reachable           |

### Error envelope

Every error response has a consistent, leak-free shape (see
`src/common/filters/all-exceptions.filter.ts`):

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": ["..."] },
  "timestamp": "2026-09-04T12:00:00.000Z",
  "path": "/api/v1/echo"
}
```

In production, unexpected (non-HTTP) errors return a generic message; the real
error is logged server-side only. Stack traces, database driver errors,
filesystem paths, and secrets are never sent to clients.

---

## Database

This project targets **PostgreSQL through Prisma 7**, which uses the
`prisma-client` generator (emitting a client into `src/generated/prisma/`) plus
a driver adapter. To keep the repository type-checking and building on a fresh
clone — before the client has been generated or a database exists — all code
depends on a single **integration seam**:
[`src/database/prisma-client.ts`](src/database/prisma-client.ts).

Until you activate it, the app boots and every non-DB route works; the health DB
probe reports the database as down, and any query throws a clear
"client not generated" error.

**To activate the real client (one-time):**

```bash
# 1. Install the PostgreSQL driver adapter + driver
npm install @prisma/adapter-pg pg

# 2. Generate the client
npm run prisma:generate

# 3. In src/database/prisma-client.ts, swap the PLACEHOLDER block for the
#    REAL block (both are in the file; the real one is commented out).
```

No other code changes are required — `PrismaService` transparently becomes a
real `PrismaClient` subclass with a live connection pool.

The `prisma/schema.prisma` currently defines only the generator and datasource.
Domain models (users, products, purchases, licenses, devices, …) are added in
later phases; see [`docs/architecture.md`](docs/architecture.md).

---

## Security posture (foundation)

- **Helmet** sets hardened HTTP response headers.
- **CORS** is environment-driven; production must use an explicit allowlist.
- **Global ValidationPipe** with `whitelist`, `forbidNonWhitelisted`, and
  `transform` — unknown fields are rejected, payloads are typed.
- **Rate limiting**: a fixed-window guard (`src/common/guards/throttler.guard.ts`)
  protects every route. In production the counters are shared through
  PostgreSQL (`RateLimitWindow`, one atomic upsert per request) so limits hold
  across instances. If the store is unavailable the guard fails closed with 503.
- **Production configuration** is checked at boot by
  `src/config/production-policy.ts`. The process refuses to start with local
  storage, in-memory rate limiting, non-TLS database connections, wildcard CORS,
  placeholder secrets, or test payment keys. See [docs/deployment.md](docs/deployment.md).
- **Error handling** never leaks internals (see [error envelope](#error-envelope)).

### Logging policy

Structured, one-line-per-request logging is provided by
`src/common/interceptors/logging.interceptor.ts` and a request-id middleware.
Each log records: request id, method, route, status code, and response time.

**The logger never records** request/response bodies, headers, query strings,
passwords, access/refresh tokens, raw license tokens, private document URLs, or
any secret. Sensitive keys are redacted defensively. This policy must be
preserved as business features are added.

---

## Testing

```bash
npm run test       # unit
npm run test:e2e   # end-to-end
```

- **Unit** tests cover the root service descriptor and the health controller
  (including graceful DB-down degradation).
- **e2e** tests boot the real application (via the shared `configureApp`
  helper, so the production request pipeline is exercised) and assert: health
  liveness returns `200 { status: "ok" }`, versioning is enforced, and the
  global ValidationPipe rejects unknown/mistyped fields with the structured
  400 envelope.

The e2e suite runs **without a database**: the app boots without one in the
foundation phase, and the liveness/validation paths do not touch Postgres.

---

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes to `main`
and on all pull requests: install → (best-effort Prisma generate) → typecheck →
lint → format check → unit tests → e2e tests → build.

---

## Project structure

```
src/
  main.ts                       # bootstrap (logger, shutdown hooks, listen)
  app.module.ts                 # root composition
  app.controller.ts             # GET /api/v1  (service descriptor)
  app.service.ts
  config/
    env.validation.ts           # fail-fast env validation
    configuration.ts            # typed config factory
  common/
    configure-app.ts            # shared HTTP config (prod + e2e)
    filters/all-exceptions.filter.ts
    guards/throttler.guard.ts
    interceptors/logging.interceptor.ts
    middleware/request-id.middleware.ts
    types/                      # ApiResponse / ErrorCode contracts
  database/
    prisma-client.ts            # Prisma 7 integration seam
    prisma.service.ts
    database.module.ts
  health/
    health.controller.ts
    health.module.ts
test/
  app.e2e-spec.ts
```

See [`docs/architecture.md`](docs/architecture.md) for the design rationale,
diagrams, and the planned secure-content architecture.

## What is intentionally NOT here

This foundation intentionally excludes all business logic. **Not implemented**
(deferred to later phases): authentication/JWT/refresh tokens, password reset,
license tokens, device binding, products CRUD, purchases, payment providers
(Paystack/Flutterwave/Stripe) and webhooks, PDF upload/encryption, object
storage (S3/R2), the PDF reader and DRM (screenshot/screen-record protection,
watermarking), offline licensing, bookmarks/progress, admin, push
notifications, and analytics.

## License

UNLICENSED — private project.


### Product pricing
Products have a `price` (integer minor units; NGN uses kobo) and `currency` (default `NGN`). The payment verification flow validates the provider-reported amount against the product catalog price.

---

## Documentation map

| Document | Purpose |
| -------- | ------- |
| [docs/api-contract.md](docs/api-contract.md) | Authoritative HTTP API contract for all clients |
| [docs/pqe-artifact-protocol.md](docs/pqe-artifact-protocol.md) | Binary format and key derivation for `.pqe` artifacts |
| [docs/document-security.md](docs/document-security.md) | Threat model, encryption design and limitations |
| [docs/deployment.md](docs/deployment.md) | Production configuration, TLS, storage, monitoring and verification steps |

