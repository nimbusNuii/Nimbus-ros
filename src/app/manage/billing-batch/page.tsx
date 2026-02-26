import { BillingBatchManager } from "@/components/billing-batch-manager";
import { requirePageRole } from "@/lib/auth";
import { toNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ManageBillingBatchPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const [products, customers, setting] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    }),
    prisma.customer.findMany({
      where: {
        isActive: true,
        type: "REGULAR"
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.storeSetting.findUnique({ where: { id: 1 } })
  ]);

  return (
    <div>
      <h1 className="page-title">ลงบิลย้อนหลัง (ชำระแล้ว)</h1>
      <p className="page-subtitle">เพิ่มทีละบิลแบบชำระแล้ว เลือกวันเวลา ลูกค้า และสินค้าแบบ Modal</p>
      <BillingBatchManager
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          price: toNumber(product.price),
          stockQty: product.stockQty
        }))}
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          type: customer.type
        }))}
        currency={setting?.currency || "THB"}
      />
    </div>
  );
}
