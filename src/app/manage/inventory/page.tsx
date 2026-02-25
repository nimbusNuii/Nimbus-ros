import { requirePageRole } from "@/lib/auth";
import { InventoryLogBoard } from "@/components/inventory-log-board";

export const dynamic = "force-dynamic";

export default async function ManageInventoryPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  return (
    <div>
      <h1 className="page-title">ประวัติสต็อก</h1>
      <p className="page-subtitle">ติดตามการตัดสต็อกจากการขาย และการปรับ/เติมสต็อก</p>
      <InventoryLogBoard />
    </div>
  );
}
