import { CustomerManager } from "@/components/customer-manager";
import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

function parsePage(value?: string) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

export default async function ManageCustomersPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.customer.count();
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      orderBy: [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }],
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
      />
    </div>
  );
}
