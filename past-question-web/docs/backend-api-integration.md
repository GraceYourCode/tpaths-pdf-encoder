# Backend API integration

The frontend was implemented against the supplied backend contract. Base URL is configured by `NEXT_PUBLIC_API_URL`; routes use `/api/v1`.

| Feature | Method | Endpoint | Auth |
|---|---|---|---|
| Register | POST | `/api/v1/auth/register` | No |
| Login | POST | `/api/v1/auth/login` | No |
| Refresh | POST | `/api/v1/auth/refresh` | No |
| Logout | POST | `/api/v1/auth/logout` | Yes |
| Logout all | POST | `/api/v1/auth/logout-all` | Yes |
| Current user | GET | `/api/v1/auth/me` | Yes |
| Verify email | POST | `/api/v1/auth/verify-email` | No |
| Resend verification | POST | `/api/v1/auth/resend-verification` | No |
| Forgot password | POST | `/api/v1/auth/forgot-password` | No |
| Reset password | POST | `/api/v1/auth/reset-password` | No |
| Products | GET | `/api/v1/products` | No |
| Product | GET | `/api/v1/products/:id` | No |
| Payment verification | POST | `/api/v1/payments/verify` | Yes |
| My profile | GET/PATCH | `/api/v1/users/me` | Yes |
| My purchases | GET | `/api/v1/users/me/purchases` | Yes |
| My licenses | GET | `/api/v1/users/me/licenses` | Yes |
| My devices | GET | `/api/v1/users/me/devices` | Yes |
| Licenses | GET | `/api/v1/licenses` | Yes |

The website does not call the private document artifact endpoint. The backend's content contract requires a registered mobile device and device public key, so secured document access remains in the mobile application.
