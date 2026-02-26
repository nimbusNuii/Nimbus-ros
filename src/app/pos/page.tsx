import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { PosClient } from "@/components/pos-client";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  await requirePageRole(["CASHIER", "MANAGER", "ADMIN"]);

  const [products, customers, setting, recentOrders] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.customer.findMany({
      where: {
        isActive: true,
        type: "REGULAR"
      },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    }),
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
      <p className="page-subtitle">โหมดแท็บเล็ต 12.9 นิ้ว: เลือกเมนูไว ปรับแต่งชัด ส่งครัวและชำระเงินได้ในหน้าเดียว</p>

      <PosClient
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          imageUrl: product.imageUrl,
          price: toNumber(product.price),
          cost: toNumber(product.cost),
          stockQty: product.stockQty
        }))}
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          type: customer.type
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
