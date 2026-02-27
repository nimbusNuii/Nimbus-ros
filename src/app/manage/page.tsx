import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { StoreSettingsForm } from "@/components/store-settings-form";
import { ManageLowStockAlert } from "@/components/manage-low-stock-alert";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const LOW_STOCK_THRESHOLD = 10;

  await requirePageRole(["MANAGER", "ADMIN"]);

  const [settings, lowStockProducts] = await Promise.all([
    prisma.storeSetting.findUnique({
      where: { id: 1 }
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        stockQty: {
          lte: LOW_STOCK_THRESHOLD
        }
      },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
      take: 12
    })
  ]);

  return (
    <div className="space-y-4">
      <ManageLowStockAlert threshold={LOW_STOCK_THRESHOLD} products={lowStockProducts} />

      <StoreSettingsForm
        initialSettings={{
          businessName: settings?.businessName || "POS Shop",
          branchName: settings?.branchName || null,
          address: settings?.address || null,
          phone: settings?.phone || null,
          vatNumber: settings?.vatNumber || null,
          appThemeKey: settings?.appThemeKey || "sandstone",
          brandPrimary: settings?.brandPrimary || "#b24a2b",
          brandAccent: settings?.brandAccent || "#8f381f",
          receiptLogoUrl: settings?.receiptLogoUrl || null,
          vatEnabled: settings?.vatEnabled ?? true,
          taxRate: toNumber(settings?.taxRate ?? 7),
          currency: settings?.currency || "THB"
        }}
      />
    </div>
  );
}
