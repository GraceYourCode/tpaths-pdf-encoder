# Document Security

## Threat model

The document subsystem is designed to reduce:

- direct public-object access;
- IDOR across users/products/documents;
- use of revoked devices;
- use of suspended/revoked/expired licenses;
- access after a purchase is no longer paid;
- use of disabled/deleted documents;
- replay of long-lived content URLs;
- accidental plaintext storage;
- artifact tampering;
- leaking storage credentials or encryption master keys.

## Cryptography

PDFs are encrypted with AES-256-GCM using a random 256-bit DEK per document. The DEK is itself encrypted (wrapped) with the configured master key. The artifact contains the cryptographic metadata required by a trusted mobile reader, but never contains the master key.

The application uses Node's standard `node:crypto` primitives rather than a custom cipher.

`CONTENT_ENCRYPTION_KEY` must be a dedicated high-entropy secret in preview/production. Production configuration rejects a missing encryption key. A production deployment should move the master key into a KMS/HSM-backed secret provider; the current environment-backed key is the explicit Phase 5 key-management seam.

## Integrity

Two checksums are tracked:

- `checksumSha256`: checksum of the original plaintext PDF, exposed as metadata for client-side verification where appropriate.
- `encryptedChecksumSha256`: checksum of the stored encrypted artifact, used by the backend before delivery.

The backend rejects a stored artifact whose encrypted checksum no longer matches the database value.

## Authorization and IDOR

Every access request is bound to the authenticated `userId` and `sessionId`. Device ownership, device status, license ownership, license device binding, purchase status, product status and document status are checked server-side.

A document ID alone is never sufficient to retrieve its artifact.

## Disable/delete

Disabling a document immediately blocks content authorization. Deleting creates a `DELETED` tombstone and removes its private object on a best-effort basis. Existing purchases/licenses are not deleted or modified by document deletion.

This is intentional: entitlement records are historical/business records; content availability is controlled by document state.

## Audit

The following document events are recorded without secrets:

- `DOCUMENT_CREATED`
- `DOCUMENT_PROCESSING_FAILED`
- `DOCUMENT_RETRY_SUCCEEDED`
- `DOCUMENT_DISABLED`
- `DOCUMENT_DELETED`
- `DOCUMENT_ACCESS_AUTHORIZED`
- `DOCUMENT_INTEGRITY_FAILURE`

Raw PDFs, authorization tokens, encryption keys and storage credentials are never written to audit metadata.

## Rate limiting

Upload/access/artifact routes receive stricter per-route fixed-window throttles than the global default. The current limiter is in-memory and therefore per-process. Production multi-instance deployments should replace it with a shared Redis-backed limiter.

## Remaining client-side risks

A backend cannot prevent a legitimate mobile device from copying plaintext after the mobile reader decrypts it, taking screenshots, recording the screen, or extracting secrets from a rooted/jailbroken device. The mobile app must keep decryption keys out of normal app storage where practical and use platform secure hardware/storage and protected rendering where available.

## Device key wrapping

For mobile-ready offline decryption, device registration can include an RSA public key. The private key remains device-local. The server unwraps the per-document DEK only inside the trusted backend and wraps it to the device public key using RSA-OAEP with SHA-256. This avoids giving the mobile client the storage credential or document-encryption master key.
