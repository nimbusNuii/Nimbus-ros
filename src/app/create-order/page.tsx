import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requirePageRole } from "@/lib/auth";
import { CreateOrderClient } from "@/components/create-order-client";

export const dynamic = "force-dynamic";

export default async function CreateOrderPage() {
  await requirePageRole(["CASHIER", "MANAGER", "ADMIN"]);

  const [products, categories, customers, setting] = await Promise.all([
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
    prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.customer.findMany({
      where: {
        isActive: true,
        type: "REGULAR"
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.storeSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        businessName: "POS Shop",
        vatEnabled: true,
        taxRate: 7,
        currency: "THB"
      }
    })
  ]);

  return (
    <CreateOrderClient
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.categoryRef?.name || product.category,
        imageUrl: product.imageUrl,
        price: toNumber(product.price),
        stockQty: product.stockQty
      }))}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name
      }))}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        type: customer.type
      }))}
      vatEnabled={setting.vatEnabled}
      taxRate={toNumber(setting.taxRate)}
      currency={setting.currency}
    />
  );
}
