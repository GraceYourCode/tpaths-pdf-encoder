-- Document series and single-READY guarantee; device revocation metadata.

-- Series identifier: versions of the same logical document share it.
ALTER TABLE "Document" ADD COLUMN "seriesId" TEXT;
UPDATE "Document" SET "seriesId" = "id" WHERE "seriesId" IS NULL;
ALTER TABLE "Document" ALTER COLUMN "seriesId" SET NOT NULL;
CREATE INDEX "Document_seriesId_idx" ON "Document"("seriesId");

-- At most one READY version per series, enforced by the database.
CREATE UNIQUE INDEX "Document_one_ready_per_series"
  ON "Document"("seriesId") WHERE "status" = 'READY';

-- Device revocation metadata.
ALTER TABLE "Device" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN "revokedReason" TEXT;
