# Mobile/backend integration status (uploaded backend snapshot)

This document records the mobile contract against the backend source in this project archive. The backend is treated as authoritative; the mobile app does not invent routes or alter backend behavior.

## Implemented mobile routes and payloads

All API paths use the backend's global prefix and URI versioning: `/api/v1`.

| Mobile operation | Backend route | Request / response contract |
|---|---|---|
| Register | `POST /auth/register` | `firstName`, `lastName`, `email`, `password`, `whatsapp`; returns `{ user, verificationToken? }` |
| Login | `POST /auth/login` | `{ email, password }`; returns `{ accessToken, refreshToken, user }` |
| Refresh | `POST /auth/refresh` | `{ token: refreshToken }`; returns rotated `{ accessToken, refreshToken }` |
| Current authenticated profile | `GET /users/me` | Returns safe user fields plus `whatsapp` |
| Logout | `POST /auth/logout` | Authenticated; returns `{ loggedOut: true }` |
| User licenses | `GET /users/me/licenses` | Array of licenses with a summary product |
| User devices | `GET /users/me/devices` | Array of safe device records |
| Public product detail | `GET /products/:id` | Product and READY document summaries |
| Device registration | `POST /devices/register` | `{ deviceId: installation UUID, platform, appVersion, publicKey: base64 P-256 SPKI DER }`; response contains backend-issued `id` and `publicKeyRegistered: true` |
| License activation | `POST /licenses/activate` | `{ token, deviceId: backend-issued Device.id }`; returns a bare license row (no nested `product` object) |
| License detail | `GET /licenses/:id` | License with product and READY documents |
| License validation | `POST /licenses/:id/validate` | `{ deviceId }`; returns `{ valid, licenseId?, expiresAt? }` |
| Content authorization | `POST /content/:documentId/access` | `{ deviceId }`; returns `authorizationToken`, `expiresAt`, `document` (including `checksumSha256`) and `artifactEndpoint` |
| Artifact download | `GET /content/:documentId/artifact` | `X-Content-Authorization: <authorizationToken>` plus the normal bearer session; returns binary TPQE v1 |

The backend returns raw JSON service results on successful requests. The mobile parser accepts those raw results (and can also unwrap a `{ success, data }` envelope if a deployment adds one); errors use `{ success: false, error: { code, message } }`. Refresh uses the backend's rotating refresh-token contract.

## Critical backend blocker: content authorization enum mismatch

The uploaded backend's `ContentService.authorize()` currently contains two state comparisons that do not match the Prisma schema or the rest of the backend:

- It rejects a document unless `d.status === 'ACTIVE'`, but `DocumentStatus` has `READY`, `PROCESSING`, `DISABLED`, `DELETED` and `FAILED`; it has no `ACTIVE`.
- It rejects a product unless `l.product.status === DocumentStatus.READY`, but `ProductStatus` has `ACTIVE`, `DRAFT` and `ARCHIVED`; products do not have a `READY` state.

The same backend's artifact-delivery method correctly expects an ACTIVE product and a READY document. Therefore, the mobile app cannot successfully obtain a content authorization token for a normal ACTIVE product containing a READY document until the backend fixes those two comparisons. The mobile client intentionally does not bypass this server-side authorization gate or call the artifact endpoint without a token.

The minimal backend correction is to compare each field against its own enum (and import `ProductStatus` alongside `DocumentStatus`):

```ts
import { DocumentStatus, ProductStatus } from '../generated/prisma/enums.js';

if (!d || d.status !== DocumentStatus.READY) {
  throw new NotFoundException('Document not found');
}

// after resolving the active license:
if (
  !l ||
  l.product.status !== ProductStatus.ACTIVE ||
  (l.expiresAt && l.expiresAt <= new Date()) ||
  l.deviceId !== deviceId
) {
  throw new ForbiddenException('Content access not authorized');
}
```

That correction belongs in the backend repository and is deliberately not applied by this mobile-only change.

## Signed offline licensing is not implemented in this backend snapshot

There is no `POST /api/v1/licenses/:licenseId/offline-lease` route in `LicensesController`, and no corresponding issuance method in `LicensesService`. The mobile client therefore does not call that route and does not mint local grace periods.

Encrypted TPQE artifacts may be cached locally, but a cache is not an entitlement. Offline reading is denied unless a valid backend-signed lease has been provisioned and stored; this backend snapshot cannot currently issue one. The mobile verifier remains ready for a future agreed ES256 contract, but no signed lease is fabricated by the client.

If offline reading is required, the backend team must add the signed lease endpoint, independently repeat purchase/license/device/document checks, and publish the matching pinned ES256 public key. The mobile implementation can then wire that exact confirmed contract.

## Profile field

`GET /auth/me` and the login response use `AuthService.safe()` and omit WhatsApp. `GET /users/me` uses `UsersService.safe()` and includes `whatsapp`. The mobile app now uses `/users/me` for its full profile and watermark identity.

## Watermark and platform limits

The backend does not generate a per-user watermarked PDF. The mobile reader overlays the authenticated user's name, email, server-provided WhatsApp number (when present), and a refreshed timestamp. This is a viewport deterrent, not permanent page-level watermarking.

Android capture prevention is requested while the reader is active. iOS screenshot prevention is not guaranteed. External cameras, compromised devices and plaintext exposure during native rendering remain residual risks.

## Hardware-backed key limitation

The mobile client creates a P-256 ECDH key and stores key material in Expo SecureStore. The backend requires P-256 SPKI DER and binds artifacts to the registered backend device ID. The current JS implementation is not proof of Android Keystore or Apple Secure Enclave hardware-backed private-key custody; do not describe it as hardware-backed. Native hardware-key integration remains a separate hardening task.
