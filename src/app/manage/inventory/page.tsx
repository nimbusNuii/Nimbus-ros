import { requirePageRole } from "@/lib/auth";
import { InventoryLogBoard } from "@/components/inventory-log-board";

export const dynamic = "force-dynamic";

export default async function ManageInventoryPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  return (
    <div>
      <InventoryLogBoard />
    </div>
  );
}
