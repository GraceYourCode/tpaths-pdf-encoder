# Mobile document security

## Online authorization and download

Every reader open resolves the active license for the current backend-issued device ID, calls `POST /api/v1/licenses/:id/validate`, re-reads the license and READY document details, then calls `POST /api/v1/content/:documentId/access`. The app downloads only from the returned relative `artifactEndpoint`, passing the short-lived content token in `X-Content-Authorization` and the normal bearer session. The endpoint is constrained to the Tpaths content API path so an authorization token cannot be sent to an arbitrary origin. Download responses are non-cacheable and size-limited.

The uploaded backend currently has a defect in `ContentService.authorize()`: it compares document status with `ACTIVE` (documents use `READY`) and product status with `DocumentStatus.READY` (products use `ProductStatus.ACTIVE`). As written, a normal ACTIVE product with a READY document is denied before a content token is issued. The mobile app does not bypass this check. See `mobile-backend-gaps.md`.

## Offline behavior

The backend snapshot does not implement a signed offline-license endpoint. The mobile app does not call a speculative endpoint and never mints a local grace period. Encrypted TPQE artifacts can be cached, but cached bytes are not authorization. Offline reading is denied unless a valid backend-issued signed lease already exists and verifies against the pinned key and account/license/device/document/version/checksum claims. Because this backend cannot currently issue such a lease, offline reading is unavailable with this snapshot.

## Encrypted local cache

The server-provided TPQE artifact is stored in the app-private document directory and additionally encrypted at rest with AES-256-GCM. A random 256-bit cache key is held in Expo SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` accessibility. The document index and metadata are encrypted and authenticated before parsing. Each cache entry has a fresh 96-bit IV and 128-bit GCM tag. Logout and account invalidation clear encrypted files, the cache key, offline grants, and the cached profile.

The reader decrypts the TPQE artifact only after online authorization. Plaintext is written to a dedicated temporary cache directory for the native PDF renderer, then removed when the reader closes or the app backgrounds; the directory is also cleared when a reader session starts. Crash/power-loss cleanup is best effort, and a compromised runtime can inspect plaintext while a document is actively rendered.

## PDF watermark and capture controls

The reader overlays a tiled, semi-transparent watermark containing the authenticated user's name/email, WhatsApp number when returned by `GET /api/v1/users/me`, and a refreshed timestamp. Android capture prevention is requested while the reader is active. iOS cannot reliably prevent a user from taking a screenshot; platform capture/recording protections are deterrents, not DRM. External cameras, rooted/jailbroken devices, OS bypasses and compromised runtimes can still capture content. The watermark is a viewport overlay, not permanently embedded in the PDF pages; permanent server-side watermarking requires backend support.

## Native runtime

`react-native-quick-crypto`, `expo-screen-capture`, and `react-native-pdf-jsi` require native development/production builds. Expo Go is not a supported secure-reader runtime. The current JavaScript key storage is not hardware-backed key custody. Android and iOS device builds and real-device capture/decryption tests remain release gates.
