import { MenuOptionManager } from "@/components/menu-option-manager";
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

type MenuOptionSort = "type_order_label" | "label_asc" | "label_desc" | "order_asc" | "order_desc" | "created_desc" | "created_asc";

function parseSort(value?: string): MenuOptionSort {
  const allowed: MenuOptionSort[] = [
    "type_order_label",
    "label_asc",
    "label_desc",
    "order_asc",
    "order_desc",
    "created_desc",
    "created_asc"
  ];
  if (value && allowed.includes(value as MenuOptionSort)) {
    return value as MenuOptionSort;
  }
  return "type_order_label";
}

function orderByFromSort(sort: MenuOptionSort): Prisma.MenuOptionOrderByWithRelationInput[] {
  if (sort === "label_asc") return [{ label: "asc" }];
  if (sort === "label_desc") return [{ label: "desc" }];
  if (sort === "order_asc") return [{ sortOrder: "asc" }, { label: "asc" }];
  if (sort === "order_desc") return [{ sortOrder: "desc" }, { label: "asc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }];
}

export default async function ManageMenuOptionsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 120);
  const sort = parseSort(params.sort);
  const where: Prisma.MenuOptionWhereInput | undefined = q
    ? {
        label: { contains: q, mode: "insensitive" }
      }
    : undefined;
  const orderBy = orderByFromSort(sort);
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.menuOption.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const options = await prisma.menuOption.findMany({
    where,
    orderBy,
    skip,
    take: PAGE_SIZE
  });

  return (
    <div>
      <MenuOptionManager
        initialOptions={options.map((item) => ({
          id: item.id,
          type: item.type,
          label: item.label,
          sortOrder: item.sortOrder,
          isActive: item.isActive
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
