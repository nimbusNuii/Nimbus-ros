import { ExpenseManager } from "@/components/expense-manager";
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

type ExpenseSort = "incurred_desc" | "incurred_asc" | "amount_desc" | "amount_asc" | "created_desc" | "created_asc";

function parseSort(value?: string): ExpenseSort {
  const allowed: ExpenseSort[] = ["incurred_desc", "incurred_asc", "amount_desc", "amount_asc", "created_desc", "created_asc"];
  if (value && allowed.includes(value as ExpenseSort)) {
    return value as ExpenseSort;
  }
  return "incurred_desc";
}

function orderByFromSort(sort: ExpenseSort): Prisma.ExpenseOrderByWithRelationInput[] {
  if (sort === "incurred_asc") return [{ incurredOn: "asc" }];
  if (sort === "amount_desc") return [{ amount: "desc" }, { incurredOn: "desc" }];
  if (sort === "amount_asc") return [{ amount: "asc" }, { incurredOn: "desc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ incurredOn: "desc" }];
}

type ExpenseTypeFilter = "ALL" | "INGREDIENT" | "STAFF" | "ELECTRICITY" | "OTHER";

function parseType(value?: string): ExpenseTypeFilter {
  const allowed: ExpenseTypeFilter[] = ["ALL", "INGREDIENT", "STAFF", "ELECTRICITY", "OTHER"];
  if (value && allowed.includes(value as ExpenseTypeFilter)) {
    return value as ExpenseTypeFilter;
  }
  return "ALL";
}

export default async function ManageExpensesPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string; type?: string; from?: string; to?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 120);
  const sort = parseSort(params.sort);
  const type = parseType(params.type);
  const from = params.from || "";
  const to = params.to || "";
  const requestedPage = parsePage(params.page);

  const where: Prisma.ExpenseWhereInput = {
    type: type === "ALL" ? undefined : type,
    incurredOn:
      from || to
        ? {
            gte: from ? new Date(`${from}T00:00:00`) : undefined,
            lte: to ? new Date(`${to}T23:59:59`) : undefined
          }
        : undefined,
    ...(q
      ? {
          note: {
            contains: q,
            mode: "insensitive"
          }
        }
      : {})
  };
  const orderBy = orderByFromSort(sort);

  // Parallelize count + storeSetting (neither depends on the other)
  const [totalItems, settings] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.storeSetting.findUnique({ where: { id: 1 } })
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const expenses = await prisma.expense.findMany({
    where,
    orderBy,
    skip,
    take: PAGE_SIZE
  });

  return (
    <div>
      <ExpenseManager
        initialExpenses={expenses.map((expense) => ({
          ...expense,
          amount: toNumber(expense.amount),
          incurredOn: expense.incurredOn.toISOString()
        }))}
        currency={settings?.currency || "THB"}
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalItems={totalItems}
        initialQuery={q}
        initialSort={sort}
        initialType={type}
        initialFrom={from}
        initialTo={to}
      />
    </div>
  );
}
