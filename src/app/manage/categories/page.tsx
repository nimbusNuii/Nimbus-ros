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
