# Backend integration gaps

## 1. Payment initialization endpoint

**Missing capability:** the supplied backend exposes `POST /api/v1/payments/verify` and a public webhook, but no authenticated payment-initialization endpoint.

**Frontend impact:** the student web client uses the Paystack browser SDK with `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` to start the provider checkout, then calls the real backend verification endpoint. This avoids inventing a backend route, but provider initialization is therefore configured on the web client.

**Suggested future backend contract:** an authenticated `POST /api/v1/payments/initialize` that accepts a product ID and returns a provider authorization URL/reference. The backend should derive the amount from the product catalog and keep all server-side payment configuration private.

## 2. Activation token retrieval after page refresh

**Missing capability:** `GET /api/v1/users/me/purchases` and `GET /api/v1/users/me/licenses` do not return an activation token. The token is returned by `POST /api/v1/payments/verify` only when a purchase is newly created.

**Frontend impact:** the token is shown only on the immediate verified-payment confirmation page. It is not copied into long-term browser storage.

**Suggested future backend contract:** a one-time, authenticated token retrieval endpoint or a secure post-purchase delivery mechanism if the product requires students to recover a token later.

## 3. Email verification links

The backend mail service currently sends the raw verification token as email text, not a clickable website URL. In production the registration response deliberately omits the raw token.

**Frontend impact:** the verification page supports token entry and development-mode token display when the backend returns one, but a production click-through URL cannot be implemented solely in the frontend without changing the backend email template/configuration.

## 4. WhatsApp number

The supplied backend `User` model and registration DTO contain `firstName`, `lastName`, `email`, and `password`, but no WhatsApp field. The web registration form therefore follows the actual backend contract rather than pretending the field is persisted.

**Suggested future backend contract:** add the WhatsApp field to the User model, registration/update DTOs, safe user responses, and migration before making it mandatory in the frontend.
