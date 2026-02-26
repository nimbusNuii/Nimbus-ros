import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { PosClient } from "@/components/pos-client";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  await requirePageRole(["CASHIER", "MANAGER", "ADMIN"]);

  const [products, setting, recentOrders] = await Promise.all([
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
    }),
    prisma.order.findMany({
      where: {
        status: "PAID"
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10,
      include: {
        items: {
          select: {
            qty: true
          }
        }
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
        initialRecentReceipts={recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          paymentMethod: order.paymentMethod,
          customerType: order.customerType,
          customerName: order.customerName,
          itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
          total: toNumber(order.total)
        }))}
      />
    </div>
  );
}
