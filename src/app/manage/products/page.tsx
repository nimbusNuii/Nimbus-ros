import { ProductManager } from "@/components/product-manager";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

function parsePage(value?: string) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

type ProductSort = "category_name" | "name_asc" | "name_desc" | "stock_asc" | "stock_desc" | "price_asc" | "price_desc";

function parseSort(value?: string): ProductSort {
  const allowed: ProductSort[] = [
    "category_name",
    "name_asc",
    "name_desc",
    "stock_asc",
    "stock_desc",
    "price_asc",
    "price_desc"
  ];
  if (value && allowed.includes(value as ProductSort)) {
    return value as ProductSort;
  }
  return "category_name";
}

function orderByFromSort(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "name_asc") return [{ name: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }];
  if (sort === "stock_asc") return [{ stockQty: "asc" }, { name: "asc" }];
  if (sort === "stock_desc") return [{ stockQty: "desc" }, { name: "asc" }];
  if (sort === "price_asc") return [{ price: "asc" }, { name: "asc" }];
  if (sort === "price_desc") return [{ price: "desc" }, { name: "asc" }];
  return [{ category: "asc" }, { name: "asc" }];
}

export default async function ManageProductsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 120);
  const sort = parseSort(params.sort);
  const where: Prisma.ProductWhereInput | undefined = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } }
        ]
      }
    : undefined;
  const orderBy = orderByFromSort(sort);
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

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
      where,
      orderBy,
      skip,
      take: PAGE_SIZE
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
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalItems={totalItems}
        initialQuery={q}
        initialSort={sort}
      />
    </div>
  );
}
