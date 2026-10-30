# API contract

Base URL: `/api/v1`.

## Public
- `GET /health`
- `GET /health/db`
- `GET /openapi/json`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /products`
- `GET /products/:id`
- `POST /payments/webhook`

## Authenticated student
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`
- `GET/PATCH /users/me`
- `GET /users/me/licenses`
- `GET /users/me/purchases`
- `GET /users/me/devices`
- `GET/POST /devices...`
- `GET/POST /licenses...`
- `POST /payments/verify`
- `POST /content/:documentId/access`

## Admin
- `/admin/dashboard`
- `/admin/products...`
- `/admin/products/:productId/documents...`
- `/admin/documents...`
- `/admin/students...`
- `/admin/purchases...`
- `/admin/licenses...`
- `/admin/tokens...`
- `/admin/audit-logs`

Responses use explicit DTO-shaped objects; secrets and raw token hashes are never returned.
