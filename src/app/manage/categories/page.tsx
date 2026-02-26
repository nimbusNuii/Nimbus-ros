import { CategoryManager } from "@/components/category-manager";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManageCategoriesPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const categories = await prisma.productCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          products: true
        }
      }
    }
  });

  return (
    <div>
      <h1 className="page-title">จัดการหมวดหมู่สินค้า</h1>
      <p className="page-subtitle">สร้างหมวดหมู่แบบแยก และนำไปเลือกใช้ในหน้าเพิ่มสินค้า</p>
      <CategoryManager
        initialCategories={categories.map((item) => ({
          id: item.id,
          name: item.name,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          productCount: item._count.products
        }))}
      />
    </div>
  );
}
