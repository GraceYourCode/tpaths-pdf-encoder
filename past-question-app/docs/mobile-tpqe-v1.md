# Mobile P-256 device identity and TPQE v1

The mobile app now uses `react-native-quick-crypto` for native OpenSSL-backed
P-256 ECDH, SHA-256, HMAC-SHA256/HKDF, and AES-256-GCM operations. Do not use
`jsrsasign` RSA keys or the legacy `PQENC01` format for protected documents.

## Installation / native build

Install the declared native dependencies with `npm install` (the current
container could not reach the npm registry to regenerate the lockfile, so run
this once to refresh `package-lock.json`) and rebuild the native app; this
module is not available in Expo Go. The Expo config plugin is enabled in
`app.json`. Rebuild both Android and iOS development/production clients after
installing the dependency.

## Device enrollment

1. The app generates a fresh `prime256v1` ECDH key pair.
2. It exports the public point in uncompressed SEC1 form and prepends the exact
   26-byte P-256 SPKI DER prefix. The 91-byte DER SPKI is sent as standard base64.
3. The client sends a random installation UUID to `POST /api/v1/devices/register`.
4. The client requires `publicKeyRegistered === true` and persists the returned
   backend `Device.id`. All later license activation, authorization, and artifact
   decryption use this backend-issued ID, never the installation UUID.
5. Once the backend ID is saved, the app reuses it and does not silently
   re-register a device that may have been revoked. If initial registration
   fails before the ID is saved, the same installation UUID and key are reused
   for a safe retry. The server remains authoritative for device status.

## TPQE v1

`src/security/document.ts` implements the 245-byte header parser, device and
optional document UUID binding, optional plaintext-PDF SHA-256 verification against the `checksumSha256` field in the access response,
P-256 ECDH, HKDF-SHA256 with the exact protocol info string, and both AES-256-GCM
verification steps. It returns plaintext only after both tags verify. Unknown
versions/suites, malformed lengths, wrong-device artifacts, and authentication
failures are rejected. The parser follows
`past-question-backend/docs/pqe-artifact-protocol.md` byte-for-byte.

## Key-storage boundary

The private scalar is stored in Expo SecureStore, with a device-only Keychain
accessibility class. `react-native-quick-crypto` performs cryptographic
operations in native code, but this design does **not** claim that the private
key is generated inside Android Keystore or Apple Secure Enclave. Hardware
non-exportable key custody requires a dedicated platform-key module and remains
separate from this interoperability implementation.

## Required release verification

Before shipping, run a clean `npm install`, `npx expo prebuild --clean`, Android
and iOS native builds, and device-level interoperability tests using a backend
TPQE fixture. Confirm: the registration response has `publicKeyRegistered`, the
returned `id` is persisted, a backend artifact decrypts to the exact source PDF,
and mutations to every authenticated header region, wrapped-DEK tag, PDF tag,
wrong device ID, and wrong private key all fail closed. The build and physical
device checks cannot be run in this source-only environment.
