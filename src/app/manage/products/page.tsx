import { ProductManager } from "@/components/product-manager";
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

export default async function ManageProductsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.product.count();
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
      orderBy: [{ category: "asc" }, { name: "asc" }],
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
      />
    </div>
  );
}
