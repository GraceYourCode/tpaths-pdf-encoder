# TPQE v1 — Device-Bound Artifact Protocol

This document is the normative specification shared by the backend and the
mobile clients. The reference implementation is
`src/common/utils/pqe.ts`; the test vectors and tamper checks are in
`src/common/utils/pqe.spec.ts`.

## Algorithms (suite 1)

| Purpose              | Algorithm                                   |
| -------------------- | ------------------------------------------- |
| Device key           | ECDSA-capable NIST P-256 (`prime256v1`) key |
| Key agreement        | ECDH, ephemeral (backend) × static (device) |
| Key derivation       | HKDF-SHA256, 32-byte output                 |
| Symmetric encryption | AES-256-GCM, 12-byte IV, 16-byte tag        |

Any other suite identifier, curve or version is rejected.

## Device public key encoding

- DER-encoded `SubjectPublicKeyInfo`, transported as standard base64.
- Exactly 91 bytes: the fixed P-256 prefix
  `3059301306072a8648ce3d020106082a8648ce3d030107034200` followed by a
  65-byte uncompressed point (`0x04 || X || Y`).
- The backend rejects any other length, prefix, curve, compressed point, or
  point not on the curve.
- Registration stores the canonical base64 SPKI in `Device.publicKey`. An
  existing registered key cannot be replaced by a new registration request;
  replacement requires revoking the device.

## Binary layout (big-endian, fixed offsets)

| Offset | Length | Field                                          |
| -----: | -----: | ---------------------------------------------- |
|      0 |      4 | Magic `TPQE` (ASCII)                           |
|      4 |      1 | Format version (`1`)                           |
|      5 |      1 | Suite (`1`)                                    |
|      6 |      2 | Reserved (must be `0x0000`)                    |
|      8 |     16 | Artifact ID (UUID bytes)                       |
|     24 |     16 | Document ID (UUID bytes)                       |
|     40 |     16 | Device ID (backend-issued UUID bytes)          |
|     56 |     65 | Ephemeral P-256 public key (uncompressed)      |
|    121 |     32 | HKDF salt (random)                             |
|    153 |     12 | DEK wrap IV                                    |
|    165 |     32 | Wrapped DEK (AES-256-GCM ciphertext)           |
|    197 |     16 | DEK wrap tag                                   |
|    213 |     12 | PDF IV                                         |
|    225 |      4 | Ciphertext length (`u32`)                      |
|    229 |     16 | PDF tag                                        |
|    245 |      N | PDF ciphertext (`N` = ciphertext length)       |

The header is exactly 245 bytes. Total artifact length is `245 + N`.

## Key derivation

1. `shared = ECDH(ephemeral_private, device_public)` — 32-byte x-coordinate.
2. `info = "TPATHS-PQE/v1/dek-wrap" || device_id(16) || SHA-256(device_spki_der)`.
3. `wrap_key = HKDF-SHA256(ikm = shared, salt = header[121:153], info, 32)`.

Binding the device ID and the device key hash into `info` means an artifact
addressed to one device cannot be unwrapped under another device's key.

## Encryption (backend)

1. Generate a random 256-bit DEK, a random 96-bit wrap IV, a random salt, and an
   ephemeral P-256 key pair — all fresh per artifact.
2. Wrap the DEK: AES-256-GCM under `wrap_key`, IV `header[153:165]`, AAD =
   `header[0:153]` (magic through salt). Store the ciphertext in `[165:197]`
   and the tag in `[197:213]`.
3. Encrypt the PDF: AES-256-GCM under the DEK, IV `header[213:225]`, AAD =
   `header[0:229]` (everything up to the PDF tag, including the length field).
   Store the tag in `[229:245]`.
4. Output `header || ciphertext`.

## Decryption (device)

1. Parse the header strictly (see validation below).
2. Compute `shared` with the device private key and the ephemeral public key.
3. Derive `wrap_key` exactly as above, using the device's own public key.
4. Unwrap the DEK. **Fail if the GCM tag does not verify.**
5. Decrypt the PDF. **Fail if the GCM tag does not verify.** Only then expose
   plaintext to the reader. Never write unauthenticated plaintext to disk.

## Strict parsing rules

Reject the artifact if any of the following hold:

- Length is less than 245 bytes, or greater than 245 + 256 MiB.
- Magic is not `TPQE`.
- Version is not `1`. Suite is not `1`.
- Reserved bytes are not zero.
- Ciphertext length field does not equal `artifact_length - 245`.
- Ciphertext length is zero or exceeds 256 MiB.
- Ephemeral point does not start with `0x04`, or is not on the curve.

Filenames and HTTP headers are never trusted as evidence of authenticity.

## Backend delivery rules

`GET /api/v1/content/:documentId/artifact` with `X-Content-Authorization`:

1. Verify the content-authorization JWT signature and expiry.
2. Require the token's `doc` to equal the requested document.
3. Require the token's `sub`, `license` and `device` to match the **current**
   license record (`userId`, `id`, `deviceId`).
4. Require a paid purchase, an active license, an active product, a READY
   document, and an ACTIVE device owned by the same user that has a registered
   public key.
5. Only then encode and return the artifact.

## Client-side limits

The device private key must be generated and kept in platform hardware where
available (Android Keystore, Apple Secure Enclave/Keychain). Until those native
modules exist, a client cannot satisfy the hardware-binding requirement, and
must not describe its protection as hardware-backed.

## Versioning

A future format change must increment the version byte. Parsers must reject
unknown versions rather than attempting best-effort decoding.
