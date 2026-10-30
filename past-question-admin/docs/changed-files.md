# Changed Files

| File | Action | Reason |
|---|---|---|
| `lib/api/types.ts` | Modified | Replaced the old planned-contract types with adapters for the implemented backend enums and response shapes. |
| `lib/api/auth.ts` | Modified | Connected authentication to the actual `/auth/*` routes and enforced admin-role mapping. |
| `lib/api/server.ts` | Modified | Centralized server-side cookie token forwarding without a session import cycle. |
| `lib/api/products.ts` | Modified | Connected actual admin product/document routes and mapped backend product/document shapes. |
| `lib/api/students.ts` | Modified | Connected actual student routes and mapped uppercase backend statuses/pagination. |
| `lib/api/tokens.ts` | Modified | Connected actual token list/create/revoke routes and mapped the backend's single-token response. |
| `lib/api/dashboard.ts` | Modified | Connected `GET /admin/dashboard` and mapped nested aggregate counts. |
| `lib/api/errors.ts` | Modified | Prevented unexpected internal error messages from being shown to administrators. |
| `lib/api/errors.test.ts` | Modified | Updated the safe generic-error expectation. |
| `lib/session.ts` | Modified | Validates the backend identity for protected sessions and requires an admin role. |
| `proxy.ts` | Modified | Adds expired-access-token refresh using the httpOnly refresh cookie. |
| `next.config.ts` | Modified | Raises the Server Action body limit to the backend's 25 MB PDF limit. |
| `.env.example` | Modified | Documents the server-only backend URL and session configuration. |
| `app/actions/auth.ts` | Modified | Uses the real backend admin login result through the updated auth service. |
| `app/actions/products.ts` | Modified | Maps form fields to actual product DTOs and forwards required document metadata. |
| `app/actions/students.ts` | Modified | Uses actual backend student status values through the API mapper. |
| `app/actions/tokens.ts` | Modified | Maps batch UI requests to repeated real single-token backend calls without persisting plaintext codes. |
| `app/(dashboard)/page.tsx` | Modified | Displays real dashboard aggregates supported by the backend. |
| `app/(dashboard)/products/page.tsx` | Modified | Removes unsupported price display and uses actual product/document data. |
| `app/(dashboard)/products/product-form.tsx` | Modified | Sends the backend-supported product fields while preserving the existing form structure. |
| `app/(dashboard)/products/[id]/page.tsx` | Modified | Uses actual product/document mappings and backend archival lifecycle. |
| `app/(dashboard)/products/[id]/document-manager.tsx` | Modified | Matches the backend's 25 MB upload limit and document metadata. |
| `app/(dashboard)/products/[id]/delete-product.tsx` | Modified | Labels the existing delete control as archive because the backend archives products. |
| `app/(dashboard)/tokens/page.tsx` | Modified | Displays actual token purchase linkage and product titles without exposing secrets. |
| `app/(dashboard)/tokens/token-generator.tsx` | Modified | Removes the unsupported student-email assignment field. |
| `README.md` | Modified | Replaced the obsolete planned-backend documentation with the implemented integration. |
| `docs/backend-integration.md` | Added | Documents route mapping, session flow, security, and contract gaps. |
| `docs/backend-integration-gaps.md` | Added | Lists backend limitations that cannot be represented without inventing data or endpoints. |
| `docs/changed-files.md` | Added | Provides this change manifest. |
