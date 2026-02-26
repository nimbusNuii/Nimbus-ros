import { KitchenBoard } from "@/components/kitchen-board";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  await requirePageRole(["KITCHEN", "MANAGER", "ADMIN"]);

  return (
    <div>
      <KitchenBoard />
    </div>
  );
}
