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

Artifacts use the TPQE v1 format, specified in `docs/pqe-artifact-protocol.md`.

Each artifact has a fresh random 256-bit AES-GCM document key (DEK) and a fresh
ephemeral P-256 key pair. The DEK is wrapped to the registered device public
key with ECDH, HKDF-SHA256 and AES-256-GCM. The PDF is encrypted with the DEK
using AES-256-GCM. No long-lived master key is used to encrypt artifacts, and
the device ID is never used as a key-derivation input on its own.

The `ARTIFACT_ENCRYPTION_KEY` setting is no longer used for artifact encryption.

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

Device registration accepts an optional P-256 SubjectPublicKeyInfo key
(base64 DER). The backend validates the curve and encoding, and refuses to
replace a registered key without revoking the device. Artifact delivery
requires the device to have a registered key.

The mobile private key must remain on the device in platform-protected storage.

## At-rest encryption of stored originals

Original PDFs are encrypted before they reach object storage. Each object has a
random 256-bit data key, wrapped under a versioned master key (AES-256-GCM).
The object is authenticated end to end. On delivery the decrypted PDF is checked
against the SHA-256 recorded at upload. A mismatch is audited as
`DOCUMENT_INTEGRITY_FAILURE` and no artifact is produced. Layout and key rotation
are described in `src/common/utils/at-rest.ts` and `docs/deployment.md`.

Storage keys and storage credentials are never returned to clients.

## Limitations

- Encryption does not prevent a legitimately entitled user from copying content
  they can view. Decrypted content exists on the device while it is displayed.
- A rooted or jailbroken device, a debugger, or screen capture can expose
  decrypted content. Hardware-backed device keys reduce key extraction, but they
  do not make the rendered content secret.
- Compromise of the running backend process exposes the master keys held in
  memory and the ability to issue artifacts.
- Offline access: artifacts already downloaded remain readable on that device
  until the local cache policy removes them. Server-side revocation prevents new
  downloads only.

