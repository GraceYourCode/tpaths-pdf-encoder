-- Phase 5: secure document lifecycle and encrypted artifact metadata.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

ALTER TYPE "DocumentStatus" RENAME TO "DocumentStatus_old";
CREATE TYPE "DocumentStatus" AS ENUM ('PROCESSING', 'READY', 'DISABLED', 'DELETED', 'FAILED');

ALTER TABLE "Document"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Document"
  ALTER COLUMN "status" TYPE "DocumentStatus"
  USING (
    CASE "status"::text
      WHEN 'DRAFT' THEN 'READY'
      WHEN 'ACTIVE' THEN 'READY'
      WHEN 'ARCHIVED' THEN 'DISABLED'
      ELSE 'FAILED'
    END
  )::"DocumentStatus";

ALTER TABLE "Document"
  ALTER COLUMN "status" SET DEFAULT 'PROCESSING';

DROP TYPE "DocumentStatus_old";

ALTER TABLE "Device"
  ADD COLUMN "publicKey" TEXT;

ALTER TABLE "Document"
  ADD COLUMN "encryptedSizeBytes" INTEGER,
  ADD COLUMN "encryptedChecksumSha256" TEXT,
  ADD COLUMN "encryptionKeyVersion" TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "Document_productId_status_idx";
CREATE INDEX "Document_productId_status_idx" ON "Document"("productId", "status");
CREATE INDEX "Document_status_updatedAt_idx" ON "Document"("status", "updatedAt");

ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_productId_fkey";
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
