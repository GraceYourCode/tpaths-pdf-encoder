# Mobile/backend contract gaps

## WhatsApp number
The current backend `User` model has no WhatsApp/phone field. Registration therefore cannot make WhatsApp server-authoritative, and the mobile app must not use a locally editable number as an authorization identity. The app collects it and keeps it in SecureStore only as a temporary client field; the reader displays an explicit unavailable fallback until the backend exposes the field from the authenticated user profile.

Required backend change: add a normalized WhatsApp field to `User`, validate it at registration/profile level, return it from `/auth/me` or `/users/me`, and use that server value for watermarking.

## Server-rendered watermark
The backend currently returns encrypted PDF artifacts, not a watermark-rendered artifact. The reader therefore applies a dynamic red overlay over the PDF viewport. This is a deterrent, not permanent per-page PDF watermarking. Stronger enforcement requires the backend to bind the watermark into authorized page renderings or provide a watermark-aware document service.

## Offline revocation policy
The backend authorizes downloads online and returns a short-lived content token, but it does not define a separate offline lease/revalidation endpoint. The app therefore does not invent a time limit for legitimate cached artifacts. Existing offline copies remain subject to the device's local protections until a backend-supported offline policy exists.

## PDF native module
The original Expo starter had no PDF renderer. The implementation uses `react-native-pdf-jsi`, which requires an Expo development/production native build rather than Expo Go. Its Expo config plugin is enabled in `app.json`.
