-- Add server-owned catalog pricing. Amounts are stored in the currency's minor unit (for NGN, kobo).
ALTER TABLE "Product" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';

-- Existing products are intentionally initialized to 0 so this migration is safe for existing rows.
-- Before an existing product is made ACTIVE, set a real positive price through the admin product API.
