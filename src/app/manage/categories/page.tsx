import { CategoryManager } from "@/components/category-manager";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

function parsePage(value?: string) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

type CategorySort = "order_name" | "name_asc" | "name_desc" | "order_asc" | "order_desc" | "created_desc" | "created_asc";

function parseSort(value?: string): CategorySort {
  const allowed: CategorySort[] = ["order_name", "name_asc", "name_desc", "order_asc", "order_desc", "created_desc", "created_asc"];
  if (value && allowed.includes(value as CategorySort)) {
    return value as CategorySort;
  }
  return "order_name";
}

function orderByFromSort(sort: CategorySort): Prisma.ProductCategoryOrderByWithRelationInput[] {
  if (sort === "name_asc") return [{ name: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }];
  if (sort === "order_asc") return [{ sortOrder: "asc" }, { name: "asc" }];
  if (sort === "order_desc") return [{ sortOrder: "desc" }, { name: "asc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ sortOrder: "asc" }, { name: "asc" }];
}

export default async function ManageCategoriesPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 120);
  const sort = parseSort(params.sort);
  const where: Prisma.ProductCategoryWhereInput | undefined = q
    ? {
        name: { contains: q, mode: "insensitive" }
      }
    : undefined;
  const orderBy = orderByFromSort(sort);
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.productCategory.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const categories = await prisma.productCategory.findMany({
    where,
    orderBy,
    skip,
    take: PAGE_SIZE,
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
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalItems={totalItems}
        initialQuery={q}
        initialSort={sort}
      />
    </div>
  );
}
