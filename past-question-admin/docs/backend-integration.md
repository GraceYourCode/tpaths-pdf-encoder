# Admin ↔ Backend Integration

## Request path

```text
Admin UI
  ↓
Server Component / Server Action
  ↓
lib/api domain service
  ↓
lib/api/server.ts
  ↓
lib/api/client.ts
  ↓
/api/v1 NestJS backend
```

The browser does not call the backend directly. Access and refresh tokens remain in `httpOnly` cookies.

## Authentication

| Admin operation | Backend route | Frontend mapping |
|---|---|---|
| Login | `POST /auth/login` | Maps backend `user` to `AdminUser`; rejects `STUDENT`. |
| Current identity | `GET /auth/me` | Verifies the session and requires `ADMIN`/`SUPER_ADMIN`. |
| Refresh | `POST /auth/refresh` | Sends `{ token }`; rotates cookies when the proxy refreshes an expired access token. |
| Logout | `POST /auth/logout` | Best-effort server invalidation followed by local cookie clearing. |

## Admin routes consumed

### Dashboard

- `GET /admin/dashboard`

Backend nested aggregates are mapped to the dashboard's supported metrics: products, students, licenses, tokens, and paid purchases.

### Products

- `GET /admin/products?page&limit&search&status`
- `GET /admin/products/:id`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id`

The backend uses `DRAFT | ACTIVE | ARCHIVED`; the UI uses `draft | published | archived`. `course` is displayed as the existing course-code field. Unsupported frontend-only price/year values are not submitted.

### Documents

- `POST /admin/products/:productId/documents`
- `GET /admin/products/:productId/documents` (available through the backend; the supplied UI obtains document metadata from product detail)
- `GET /admin/documents/:id` (backend route; not needed by the supplied UI)
- `PATCH /admin/documents/:id` (backend route; not needed by the supplied UI)
- `DELETE /admin/documents/:id`

Uploads are multipart form data and include the selected PDF plus backend-required `title` and `status` fields. No public storage URL is exposed.

### Students

- `GET /admin/students?page&limit&search&status`
- `GET /admin/students/:id`
- `PATCH /admin/students/:id/status`

The UI status values are mapped to/from backend uppercase values.

### Tokens

- `GET /admin/tokens`
- `POST /admin/tokens`
- `POST /admin/tokens/:id/suspend` (backend route; no supplied UI action)
- `POST /admin/tokens/:id/revoke`

The backend currently creates one token per request and returns the plaintext token only at creation. The frontend never stores it and only returns it to the client through the one-time Server Action result for immediate display.

### Licenses, purchases, devices

The backend exposes admin license and purchase routes and user device routes, but the supplied admin UI has no dedicated screens for these resources. They were not added solely to manufacture UI coverage.

## Error handling

`lib/api/client.ts` accepts the backend's `{ success, data }` envelope or a bare JSON response. HTTP failures become typed `ApiError` instances for 400/401/403/404/409/429/501/5xx cases. Unknown client errors are surfaced with a generic safe message.

## Session expiry

The Next.js proxy checks the access token expiry only to decide whether a refresh attempt is needed. Authorization is never based on decoded claims: protected pages call the backend, and `requireSession()` verifies `/auth/me` and the admin role.

## Known backend contract gaps

- Product price/year are absent from the backend model.
- Document page count/reference are absent from the backend response.
- Token list responses do not contain a masked token value; the frontend uses a non-secret ID-derived display mask.
- Token generation is single-token and has no student-email assignment.
- Student list responses do not provide `lastActiveAt` or purchase counts; the frontend does not fabricate these values.
