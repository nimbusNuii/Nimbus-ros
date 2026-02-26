import { CustomerManager } from "@/components/customer-manager";
import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ManageCustomersPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      orderBy: [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }]
    }),
    prisma.storeSetting.findUnique({ where: { id: 1 } })
  ]);

  return (
    <div>
      <CustomerManager initialCustomers={customers} currency={settings?.currency || "THB"} />
    </div>
  );
}
