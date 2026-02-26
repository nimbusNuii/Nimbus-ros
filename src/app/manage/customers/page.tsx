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
      <h1 className="page-title">จัดการลูกค้า</h1>
      <p className="page-subtitle">เพิ่ม/แก้ไขลูกค้าประจำหรือขาจร และกำหนดการใช้งานใน POS dropdown</p>
      <CustomerManager initialCustomers={customers} currency={settings?.currency || "THB"} />
    </div>
  );
}
