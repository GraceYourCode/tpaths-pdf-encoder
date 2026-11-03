# Backend Integration Gaps

These are the places where the admin console cannot be fully correct because of the backend. Each entry says what the admin does today and the backend change that would close it. The admin never invents data or fakes success to cover a gap.

Items are grouped by severity. **Blockers** break a screen completely against the current backend. **Limits** mean a screen works but cannot filter, page or show everything. The file references are to `past-question-backend/src`.

## Blockers

### B1. Every student lookup returns 404 (breaks student detail and the status toggle)
`admin/admin.service.ts` `student()` selects its fields without `role`, then checks `u.role !== 'STUDENT'`. The check therefore always fails and throws `NotFound`. `status()` calls `student()` first, so changing a student's status fails the same way. The `:id/licenses`, `:id/purchases` and `:id/devices` routes all depend on it.

**Fix:** add `role: true` to the `select` in `student()`.

### B2. Document status PATCH requires `title`
`documents/documents.controller.ts` `DocumentDto` declares `@IsString() title!: string` with no `@IsOptional()`. The same DTO serves the upload and the PATCH, so a PATCH with only `{ status }` fails validation with 400. The admin therefore sends `title` alongside `status` when it retires a version.

**Fix:** split the PATCH into its own DTO with `title` optional.

### B3. Admin device revocation does not exist
Only `POST /devices/:id/revoke` exists, and it requires the device owner's session (`devices.service.ts` checks `d.userId !== userId`). An admin cannot revoke a student's device. The student page calls `POST /admin/devices/:id/revoke`, which currently returns 404 and is shown as "Backend endpoint not available".

**Fix:** add `POST /admin/devices/:id/revoke` under `AdminModule`, with an audit event (`DEVICE_REVOKED`, with the admin as actor).

### B4. No admin device list
There is no `GET /admin/devices`. Devices are visible only per student, through B1's broken route. A standalone device screen would have nothing to call, so none was built.

**Fix:** add `GET /admin/devices?page&limit&status&userId` with a paginated envelope.

## Limits

### L1. Licenses ignore query parameters
`licenses/licenses.controller.ts` `AdminLicensesController.list()` calls `adminList({})`. Paging and the status filter never reach the service, so every request returns the newest 20 licenses. The UI detects the mismatch and shows a notice.

**Fix:** `list(@Query() q: any)` and pass `q` through.

### L2. Tokens have no paging or filters
`admin/admin.service.ts` `tokens(q)` applies only `take`. The UI fetches up to 100 rows and filters and pages them in memory, and shows a notice when the cap is hit.

**Fix:** support `page`, `limit`, `status` and `productId` with a paginated envelope.

### L3. Purchase and audit lists are bare arrays with no total
`GET /admin/purchases` and `GET /admin/audit-logs` return arrays. The purchases screen uses prev/next. Audit has no filters and no paging.

**Fix:** return the standard `{ items, total, page, limit, totalPages }` envelope and accept `page`, `limit`, plus `action` / `entityType` filters for audit.

### L4. No admin payments endpoint
There is no `GET /admin/payments`. The Payments screen is a ledger over each purchase's embedded payment record, so a payment that never became a purchase is not shown.

**Fix:** add `GET /admin/payments` with `provider`, `status` and `reference` filters, paginated, and include `eventId` and `provider` for reconciliation.

### L5. Uploading a new version does not retire the old one
`documents/documents.service.ts` `create()` marks each new document `READY` and leaves earlier `READY` versions untouched. The admin retires them after the upload, but that is two requests and the first can succeed while the second fails, leaving two live versions.

**Fix:** disable previous `READY` versions in the same transaction as the create.

### L6. Document removal sets `DISABLED`, not `DELETED`
`documents.service.ts` `remove()` writes `DISABLED`. `docs/document-system.md` and `docs/document-api.md` describe `DELETE` as a soft delete to `DELETED`, a tombstone. Either the code or the docs should change; the admin follows the code and labels the result "Disabled".

### L7. Processing and retry are not implemented
`create()` sets `READY` immediately, so `PROCESSING` and `FAILED` never occur, and `POST /admin/documents/:id/retry` documented in `docs/document-api.md` has no controller route. The UI renders all five states and the failure reason, but the processing and failure paths cannot be exercised until the backend produces them.

### L8. Admin document detail and product document list are not used
`GET /admin/products/:id/documents` and `GET /admin/documents/:id` exist. The admin reads documents through product detail instead, which is enough.

### L9. Product CRUD and document update have no tests against the backend
`products/products.service.spec.ts` is the only product spec. No test covers the admin upload, `DELETE` or `PATCH` document paths. Phase 5 notes say the backend suite was never run in a full environment.

## Not a gap, but worth knowing

- **Product price** is now in the backend. The older docs said it was missing; that is no longer true. Prices are stored in kobo, and `ACTIVE` requires a positive price.
- **Token plaintext** is returned only by `POST /admin/tokens`. Lists never include it, so the admin never shows or stores a code it cannot reproduce.
- **Student activity timestamps** (`lastActiveAt`) and **purchase counts on the list** are not returned by the backend. The admin leaves them blank rather than estimating.
- **Document page count** is not stored by the backend. The admin does not display one.
