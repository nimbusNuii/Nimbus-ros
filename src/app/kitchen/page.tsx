import { KitchenBoard } from "@/components/kitchen-board";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  await requirePageRole(["KITCHEN", "MANAGER", "ADMIN"]);

  return (
    <div>
      <h1 className="page-title">หน้าคนในครัว</h1>
      <p className="page-subtitle">ติดตามคิวออเดอร์ และเปลี่ยนสถานะรอทำ/กำลังทำ/พร้อมเสิร์ฟ</p>
      <KitchenBoard />
    </div>
  );
}
