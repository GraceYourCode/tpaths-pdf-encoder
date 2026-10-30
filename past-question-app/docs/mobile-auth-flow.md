# Authentication flow

The website and mobile app use the same backend account. The mobile app submits registration/login to `/api/v1/auth/*`, stores only access/refresh tokens in Expo SecureStore, and refreshes a 401 once using the rotated refresh token endpoint. Passwords are never persisted.

Email verification is backend/website-owned. The app checks `emailVerifiedAt` and can resend the verification email; it does not manufacture a local verified state.
