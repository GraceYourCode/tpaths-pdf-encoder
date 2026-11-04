# Deployment

This guide covers the production configuration the backend enforces at boot,
and the checks an operator must run before go-live. The policy is implemented in
`src/config/production-policy.ts`. When `NODE_ENV=production`, the process
refuses to start and lists every violation at once.

## 1. Provision

- **PostgreSQL** with TLS. Connection string must include `sslmode=require`,
  `verify-ca` or `verify-full` (`verify-full` is recommended).
- **S3-compatible object storage** (AWS S3, Cloudflare R2, MinIO). Use a private
  bucket with public access blocked and default encryption enabled. Create an
  IAM principal limited to `s3:PutObject`, `s3:GetObject` and `s3:ListBucket`
  on this bucket only.
- **Reverse proxy or load balancer** terminating TLS. Set `TRUST_PROXY` to the
  number of proxy hops (commonly `1`), or `false` if no proxy is in front.

## 2. Environment variables

Store all secrets in a secret manager and inject them at runtime. Never commit
them or bake them into images.

| Variable | Production requirement |
| -------- | ---------------------- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Must include `sslmode=require` or stronger |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CONTENT_AUTH_SECRET`, `DEVICE_HASH_PEPPER` | At least 32 characters, not placeholders, all distinct. Generate with `openssl rand -hex 32` |
| `DOCUMENT_KEY_PROVIDER` | `aws-kms` (required in production) |
| `KMS_KEY_ID`, `KMS_REGION`, `KMS_ACCESS_KEY_ID`, `KMS_SECRET_ACCESS_KEY` | Required. The IAM principal needs only `kms:Encrypt` and `kms:Decrypt` on that key |
| `KMS_ENDPOINT` | Optional https override |
| `RESEND_API_KEY`, `EMAIL_FROM` | Required. Verification email must be deliverable before accounts are accepted |
| `PAYMENT_SECRET_KEY` | Live key, prefix `sk_live_` |
| `CORS_ORIGINS` | Explicit comma-separated `https://` origins. Not `*` |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `https://` URL |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Required |
| `THROTTLE_STORE` | `postgres` (shared across instances) |
| `TRUST_PROXY` | Required. `false`, a hop count, or `loopback` |

Optional tuning: `THROTTLE_LIMIT`, `THROTTLE_TTL_MS`, `JWT_ACCESS_EXPIRATION_SEC`,
`JWT_REFRESH_EXPIRATION_MS`, `CONTENT_AUTHORIZATION_TTL_MS`.

`ARTIFACT_ENCRYPTION_KEY` is no longer used for artifact encryption. Remove it
from production secrets once you have confirmed nothing else reads it.

### Key rotation (KMS)

Rotate the KMS key in KMS (automatic rotation is supported). KMS decrypts
older ciphertexts without configuration changes. No application action is needed.

### Key rotation (legacy environment keyring, development only)

1. Generate a new 32-byte key and assign it the next version, for example `2`.
2. Set `DOCUMENT_MASTER_KEYS=1:<old>,2:<new>` and `DOCUMENT_MASTER_KEY_VERSION=2`.
3. Deploy. New uploads use version 2. Existing objects keep working under version 1.
4. Keep version 1 configured until every stored object has been re-wrapped or
   retired. Removing a version makes objects written under it unreadable.

Re-wrapping existing objects is not automated in this release.

## 3. Database

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy     # applies all migrations, including 20260920120000_rate_limit_window
npm run build
```

Before go-live, run the migrations against a **staging** PostgreSQL instance
with a copy of production-shaped data, and confirm `prisma migrate status`
reports no pending or drifted migrations.

## 4. Start and verify

```bash
npm run start:prod
```

Then check, from outside the cluster:

1. `GET /api/v1/health` returns 200.
2. `GET /api/v1/health/ready` returns 200 with `"database":"up","storage":"up"`.
   Stop the database or revoke storage credentials in staging and confirm 503.
3. Responses include `Strict-Transport-Security` (set by Helmet) and the
   `Access-Control-Allow-Origin` header only for configured origins.
4. A request from an origin not in `CORS_ORIGINS` receives no CORS allowance.
5. Make more than `THROTTLE_LIMIT` requests from one client. Confirm 429 and that
   a second instance enforces the same count (check `RateLimitWindow`).
6. Upload a test PDF through the admin route, then confirm the object in the
   bucket is not a PDF (it begins with the bytes `TPDOC`).

## 5. Payments

Configure the Paystack webhook URL to `https://<api-host>/api/v1/payments/webhook`.
Requests without a valid `x-paystack-signature` are rejected with 401. Test the
full flow in Paystack test mode in staging before switching to live keys.

## 6. Monitoring and alerting

The application provides:

- Liveness (`/health`), database readiness (`/health/db`) and full readiness
  (`/health/ready`) endpoints for load balancers.
- One structured log line per request (request id, route, status, duration).
- Audit records for security-relevant events, including `DOCUMENT_INTEGRITY_FAILURE`,
  `DEVICE_BOUND`, `PAYMENT_VERIFIED` and `WEBHOOK_RECEIVED`.

The application does **not** provide metrics export, distributed tracing or
alert rules. Before production, operators must:

- Ship logs to a central store and alert on 5xx rate and 429 spikes.
- Alert on any `DOCUMENT_INTEGRITY_FAILURE` audit record. It indicates storage
  tampering or a key problem and should be investigated immediately.
- Alert on `/health/ready` returning 503 for more than one minute.
- Monitor Paystack webhook failures and purchases stuck in `PENDING` for over
  an hour.

## 7. TLS and transport

TLS is terminated at the proxy or load balancer, not in the application. Use
TLS 1.2 or later with modern cipher suites, redirect HTTP to HTTPS, and enable
HSTS at the edge. Verify with an external scanner (for example `testssl.sh` or
SSL Labs) before go-live. These checks cannot be performed from inside this
repository.

## 8. Checks that must be performed outside this repository

- Live S3 round-trip: upload, read back, and confirm the `x-amz-server-side-encryption`
  header is applied by the provider.
- Live PostgreSQL migration on staging.
- Paystack test-mode transaction and signed webhook.
- Transactional email delivery for verification and password reset.
- External TLS and header scan of the deployed endpoint.
