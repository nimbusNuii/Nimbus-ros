-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "appThemeKey" TEXT NOT NULL DEFAULT 'sandstone',
ADD COLUMN     "brandAccent" TEXT NOT NULL DEFAULT '#8f381f',
ADD COLUMN     "brandPrimary" TEXT NOT NULL DEFAULT '#b24a2b',
ADD COLUMN     "receiptLogoUrl" TEXT;
