
-- Indexes supporting admin filtering and reconciliation queries.
-- License(productId, status) already exists from the initial migration and is not repeated here.
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "License_expiresAt_idx" ON "License"("expiresAt");