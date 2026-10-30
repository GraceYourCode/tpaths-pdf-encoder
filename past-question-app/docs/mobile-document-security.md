# Document security

Online reading starts with `POST /api/v1/content/:documentId/access`, which the backend checks against the authenticated session, device, active license, paid purchase, product and document. The returned short-lived content authorization token is then used only for the artifact request.

The app creates a random installation ID and RSA-2048 keypair. The private key and the corresponding public key are stored in Expo SecureStore; the public key is registered with `/devices/register`. The backend wraps the per-document AES-256-GCM DEK to that public key. No backend master key or storage credential is shipped.

Encrypted `.pqe` artifacts are stored under the app-private FileSystem document directory. The app decrypts only when a reader session is being opened and writes plaintext temporarily to the app-private cache for the native PDF renderer. The transient plaintext is removed when the reader closes/backgrounds where the JS lifecycle permits.

The reader requests `expo-screen-capture` protection while active. This is not a DRM guarantee: rooted/jailbroken devices, OS bypasses, external cameras and compromised runtimes can still capture content.
