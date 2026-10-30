# Document System

Phase 5 implements private, encrypted academic-document delivery on top of the existing auth, device, license, purchase, product and audit modules.

## Lifecycle

`PROCESSING -> READY` is the successful upload path.

Failure paths use `FAILED`; administrators can retry a failed record only when its encrypted artifact is still present and passes its stored encrypted checksum.

Administrators can transition a ready document to `DISABLED` or `DELETED`. A deleted document remains as a tombstone in PostgreSQL so old identifiers cannot silently become another document. Its private storage object is removed on best effort.

## Storage

The application uses a `StorageService` abstraction. The current implementation is local private storage, but the service boundary is deliberately object-store shaped (`put`, `get`, `delete`, `exists`) so an S3/R2 adapter can replace it without changing document authorization logic.

Objects are stored under generated keys and are never exposed as public URLs.

## Upload

The admin upload route:

1. Requires an authenticated `ADMIN` or `SUPER_ADMIN`.
2. Accepts multipart field `file`.
3. Requires `application/pdf`.
4. Checks the `%PDF-` magic bytes.
5. Enforces the 25 MiB request/file limit by default.
6. Computes the plaintext SHA-256 checksum.
7. Creates a `PROCESSING` document.
8. Encrypts the PDF before persistent storage using AES-256-GCM with a random per-document data-encryption key (DEK).
9. Wraps the DEK with the configured application encryption master key.
10. Stores only the encrypted artifact.
11. Records encrypted size/checksum and encryption-key version.
12. Marks the document `READY`.

The plaintext PDF is never written to the configured private-storage directory.

## Access

A student first requests a short-lived document authorization token. The backend checks:

`authenticated session -> active device -> active license -> paid purchase -> active product -> READY document`

The resulting token is scoped to the user, session, device, license and document and expires after `CONTENT_AUTHORIZATION_TTL_MS`.

The artifact endpoint requires both the normal authenticated session and the scoped content token. It rechecks the session, device, license, purchase, product and document state before returning the encrypted artifact.

The response is `application/octet-stream` and has no public storage URL. The mobile client is responsible for decrypting/rendering the encrypted artifact; the backend never sends the encryption master key.

## Important boundary

The backend protects the stored artifact and authorization path. It cannot make a compromised/rooted client, screenshots, screen recording, or an already-downloaded legitimate offline artifact impossible. Those controls belong to the mobile reader/OS security layer.

## Mobile device key

A mobile device may register an RSA public key. The private key stays on the device. When an authorized artifact is delivered, the backend unwraps the document DEK inside the trusted server boundary and re-wraps that DEK to the registered device public key. The encrypted DEK is returned in the `X-Document-Key` response header; the server never sends the master key or plaintext DEK.


## Product pricing
Product catalog records include a server-owned `price` in the currency minor unit (for NGN, kobo) and a three-letter `currency` code. Public product responses expose the price so the website can display the amount before checkout. Payment verification compares the provider-reported amount and currency against the current product price; a client-supplied amount is never trusted.
