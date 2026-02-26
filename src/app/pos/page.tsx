import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { PosClient } from "@/components/pos-client";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  await requirePageRole(["CASHIER", "MANAGER", "ADMIN"]);

  const [products, customers, setting, recentOrders, categories, menuOptions] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        categoryRef: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    }),
    prisma.customer.findMany({
      where: {
        isActive: true,
        type: "REGULAR"
      },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    }),
    prisma.storeSetting.findUnique({
      where: { id: 1 }
    }),
    prisma.order.findMany({
      where: {
        status: {
          in: ["PAID", "OPEN", "CANCELLED"]
        }
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
    }),
    prisma.productCategory.findMany({
      where: {
        isActive: true
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.menuOption.findMany({
      where: {
        isActive: true
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    })
  ]);

  return (
    <div>

      <PosClient
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.categoryRef?.name || product.category,
          imageUrl: product.imageUrl,
          price: toNumber(product.price),
          cost: toNumber(product.cost),
          stockQty: product.stockQty
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name
        }))}
        menuOptions={menuOptions.map((option) => ({
          id: option.id,
          type: option.type,
          label: option.label
        }))}
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          type: customer.type
        }))}
        vatEnabled={setting?.vatEnabled ?? true}
        taxRate={toNumber(setting?.taxRate ?? 7)}
        currency={setting?.currency || "THB"}
        initialRecentReceipts={recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          paymentMethod: order.paymentMethod,
          status: order.status,
          customerType: order.customerType,
          customerName: order.customerName,
          itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
          total: toNumber(order.total)
        }))}
      />
    </div>
  );
}
