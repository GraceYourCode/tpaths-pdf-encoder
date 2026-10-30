# Security

Implemented controls include scrypt password hashing, cryptographically random secrets, SHA-256 persistence of opaque secrets, HS256 JWT signing with separate access/refresh/content keys, refresh rotation and family revocation, global RBAC plus service-level ownership checks, rate limiting, Helmet, explicit CORS configuration, strict DTO validation, body/file size limits, PDF magic-byte validation, safe storage keys, webhook HMAC verification, idempotent payment references, database unique constraints/transactions, private content authorization, structured non-sensitive logging and audit events.

Production requirements: unique high-entropy secrets, explicit CORS origins, HTTPS, private object storage, managed PostgreSQL, secret manager, and a shared rate-limit store when horizontally scaling.
