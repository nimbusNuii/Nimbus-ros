import { CustomerManager } from "@/components/customer-manager";
import { Prisma } from "@prisma/client";
import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

function parsePage(value?: string) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

type CustomerSort = "active_type_name" | "name_asc" | "name_desc" | "created_desc" | "created_asc";

function parseSort(value?: string): CustomerSort {
  const allowed: CustomerSort[] = ["active_type_name", "name_asc", "name_desc", "created_desc", "created_asc"];
  if (value && allowed.includes(value as CustomerSort)) {
    return value as CustomerSort;
  }
  return "active_type_name";
}

function orderByFromSort(sort: CustomerSort): Prisma.CustomerOrderByWithRelationInput[] {
  if (sort === "name_asc") return [{ name: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }];
}

export default async function ManageCustomersPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 120);
  const sort = parseSort(params.sort);
  const where: Prisma.CustomerWhereInput | undefined = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { note: { contains: q, mode: "insensitive" } }
        ]
      }
    : undefined;
  const orderBy = orderByFromSort(sort);
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.customer.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip,
      take: PAGE_SIZE
    }),
    prisma.storeSetting.findUnique({ where: { id: 1 } })
  ]);

  return (
    <div>
      <CustomerManager
        initialCustomers={customers}
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
