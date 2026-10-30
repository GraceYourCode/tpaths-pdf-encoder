# Backend Integration Gaps

These are genuine differences between the supplied admin UI and the implemented backend. The frontend does not invent replacement endpoints or data.

1. **Product pricing and exam year:** the backend `Product` model has no price/currency/year fields. Those values therefore cannot be persisted by this frontend integration.
2. **Document metadata:** the backend document response does not include page count or a public/opaque reference field. The frontend displays only the returned document title, size, version, and timestamps.
3. **Token batches/assignment:** `POST /admin/tokens` creates one token per request and accepts only `productId` and optional `expiresAt`. The existing quantity UI is implemented as repeated real requests; student-email assignment is not sent because the backend has no such field.
4. **Token listing:** the backend returns token IDs and lifecycle fields, not a masked token string. The frontend uses a non-secret ID-derived display mask and never reconstructs the raw token.
5. **Student activity metrics:** the backend student list does not provide `lastActiveAt` or a purchase count. The frontend leaves unavailable values blank rather than fabricating them.
6. **Dedicated admin screens:** the supplied frontend has no license, purchase, or device management pages. Those resources were not added because the task explicitly prohibits redesigning/rebuilding the UI.
