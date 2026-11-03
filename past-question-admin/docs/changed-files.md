# Changed files (admin console remediation)

Scope: the 25 issues in the admin audit (product pricing, document lifecycle, missing admin modules, token/student views, testing). The backend was read but not modified. Every backend defect found is in `docs/backend-integration-gaps.md`.

## Pure logic (new)
- `lib/money.ts`: naira ↔ kobo parsing and formatting, with bounds for the backend `Int` column.
- `lib/jwt.ts`: `exp` inspection used by the proxy to decide when to refresh.
- `lib/products/form.ts`: product form parsing (title, status, price). Moved out of the Server Action file, which may only export async functions.
- `lib/products/upload.ts`: PDF pre-checks and the multipart payload (`file` + `title`, never `status`).
- `lib/api/token-model.ts`: token mapping, filtering and paging, split out so it is testable without `next/headers`.

## Pure logic (rewritten)
- `lib/api/types.ts`: backend enums and shapes for price/currency, the real document lifecycle, `toBackendProductBody` (explicit DTO mapping), purchases, payments, licenses, devices, audit events and student detail.
- `lib/api/errors.ts`: 413 and 415 map to upload-specific copy.

## Server wrappers (rewritten or new)
- `lib/api/products.ts`: create/update send `price` in kobo and `currency`. Document upload and removal, plus a PATCH to retire a version.
- `lib/api/tokens.ts`: fetch capped list, filter and page in memory, report truncation. Single-token generation and revoke unchanged.
- `lib/api/students.ts`: student detail, status change, and admin device revoke (depends on a backend route that does not exist yet).
- `lib/api/finance.ts` (new): purchases, licenses (list, detail, suspend, revoke), audit events.

## Server Actions
- `app/actions/products.ts`: price in create and update. Upload no longer sends `status: "ACTIVE"`, retires previous READY versions, and reports real lifecycle state. Delete revalidates the product page.
- `app/actions/students.ts`: status change revalidates the detail page. Device revoke added.
- `app/actions/licenses.ts` (new): suspend and revoke.

## UI (changed)
- `app/(dashboard)/products/product-form.tsx`: price field (naira), with a hint for unpriced products.
- `app/(dashboard)/products/page.tsx`: price column.
- `app/(dashboard)/products/[id]/page.tsx`: price line, document wiring.
- `app/(dashboard)/products/[id]/document-manager.tsx`: lifecycle badge, failure reason, version count, remove hidden once disabled.
- `app/(dashboard)/tokens/page.tsx`: notice when the list is capped at 100.
- `app/(dashboard)/students/page.tsx`: names link to the detail page.
- `components/ui/badge.tsx`: tones for document, purchase and payment states.
- `components/layout/nav.ts` and `nav.test.ts`: Purchases, Payments, Licenses and Audit log.
- `proxy.ts`: uses `lib/jwt.ts`.

## UI (new)
- `app/(dashboard)/students/[id]/page.tsx` and `revoke-device-button.tsx`: profile, status, purchases, licenses, devices.
- `app/(dashboard)/purchases/page.tsx`.
- `app/(dashboard)/payments/page.tsx`.
- `app/(dashboard)/licenses/page.tsx`, `licenses/[id]/page.tsx`, `licenses/[id]/license-actions.tsx`.
- `app/(dashboard)/audit-logs/page.tsx`.

## Tests (new or updated)
- `lib/money.test.ts`, `lib/jwt.test.ts`, `lib/products/form.test.ts`, `lib/products/upload.test.ts`, `lib/api/token-model.test.ts`, `lib/api/errors-upload.test.ts`.
- `lib/api/types.test.ts` (rewritten for the real document model and DTO contract).
- `components/layout/nav.test.ts` (updated for the new navigation).

## Docs
- `README.md`, `docs/backend-integration.md`, `docs/backend-integration-gaps.md`, `docs/changed-files.md`.
- `docs/BACKEND-REQUIREMENTS.md`: marked as superseded.
