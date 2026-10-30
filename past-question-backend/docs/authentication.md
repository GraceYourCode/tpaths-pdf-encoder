# Authentication

Registration creates a pending account and a single-use email verification secret. Login requires an active, verified account and returns a short-lived access JWT plus a database-backed refresh JWT. Refresh rotates the persisted refresh-token hash. Reuse of an old token revokes the complete token family.

Password reset responses are deliberately generic. Reset secrets are random, hashed in the database, expire after 30 minutes and invalidate active sessions after a successful password change.

Access tokens contain only `sub`, `role`, `sid`, `iat`, and `exp`. Never put secrets or sensitive profile data in JWT claims.
