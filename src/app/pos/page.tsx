import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { PosClient } from "@/components/pos-client";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  await requirePageRole(["CASHIER", "MANAGER", "ADMIN"]);

  const [products, setting] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.storeSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        businessName: "POS Shop",
        taxRate: 7,
        currency: "THB"
      }
    })
  ]);

  return (
    <div>
      <h1 className="page-title">หน้าร้าน (POS)</h1>
      <p className="page-subtitle">เลือกสินค้า คิดเงิน และออกใบเสร็จได้ทันที</p>

      <PosClient
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          price: toNumber(product.price),
          cost: toNumber(product.cost),
          stockQty: product.stockQty
        }))}
        taxRate={toNumber(setting.taxRate)}
        currency={setting.currency}
      />
    </div>
  );
}
