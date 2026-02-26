-- CreateEnum
CREATE TYPE "MenuOptionType" AS ENUM ('SPICE_LEVEL', 'ADD_ON', 'REMOVE_INGREDIENT');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "scheduledFor" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuOption" (
    "id" TEXT NOT NULL,
    "type" "MenuOptionType" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");
CREATE INDEX "ProductCategory_isActive_sortOrder_name_idx" ON "ProductCategory"("isActive", "sortOrder", "name");
CREATE UNIQUE INDEX "MenuOption_type_label_key" ON "MenuOption"("type", "label");
CREATE INDEX "MenuOption_type_isActive_sortOrder_label_idx" ON "MenuOption"("type", "isActive", "sortOrder", "label");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Order_scheduledFor_idx" ON "Order"("scheduledFor");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill category master from existing product.category values
WITH source_categories AS (
  SELECT DISTINCT trim("category") AS name
  FROM "Product"
  WHERE "category" IS NOT NULL AND trim("category") <> ''
)
INSERT INTO "ProductCategory" ("id", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
  concat('cat_', substr(md5(name || random()::text || clock_timestamp()::text), 1, 20)),
  name,
  row_number() OVER (ORDER BY name) - 1,
  true,
  now(),
  now()
FROM source_categories;

UPDATE "Product" p
SET "categoryId" = c."id"
FROM "ProductCategory" c
WHERE p."categoryId" IS NULL
  AND p."category" IS NOT NULL
  AND trim(p."category") = c."name";
