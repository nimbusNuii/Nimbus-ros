-- AlterTable
ALTER TABLE "Order" ADD COLUMN "orderDateKey" TEXT NOT NULL DEFAULT '19700101';
ALTER TABLE "Order" ADD COLUMN "orderSequence" INTEGER NOT NULL DEFAULT 0;

-- Backfill daily key and sequence from createdAt (Asia/Bangkok)
WITH ranked AS (
  SELECT
    id,
    to_char(("createdAt" AT TIME ZONE 'Asia/Bangkok'), 'YYYYMMDD') AS date_key,
    row_number() OVER (
      PARTITION BY to_char(("createdAt" AT TIME ZONE 'Asia/Bangkok'), 'YYYYMMDD')
      ORDER BY "createdAt", id
    )::integer AS seq
  FROM "Order"
)
UPDATE "Order" o
SET
  "orderDateKey" = r.date_key,
  "orderSequence" = r.seq
FROM ranked r
WHERE o.id = r.id;

-- CreateIndex
CREATE INDEX "Order_orderDateKey_orderSequence_idx" ON "Order"("orderDateKey", "orderSequence");
CREATE UNIQUE INDEX "Order_orderDateKey_orderSequence_key" ON "Order"("orderDateKey", "orderSequence");
