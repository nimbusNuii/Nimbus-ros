import { ProductManager } from "@/components/product-manager";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManageProductsPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const [products, settings, categories] = await Promise.all([
    prisma.product.findMany({
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
    prisma.storeSetting.findUnique({ where: { id: 1 } }),
    prisma.productCategory.findMany({
      where: {
        isActive: true
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    })
  ]);

  return (
    <div>
      <h1 className="page-title">จัดการสินค้า</h1>
      <p className="page-subtitle">เพิ่มเมนู ปรับราคา และจัดการสต็อกสินค้า</p>
      <ProductManager
        initialProducts={products.map((product) => ({
          ...product,
          categoryId: product.categoryId,
          category: product.categoryRef?.name || product.category,
          price: toNumber(product.price),
          cost: toNumber(product.cost)
        }))}
        initialCategories={categories}
        currency={settings?.currency || "THB"}
      />
    </div>
  );
}
