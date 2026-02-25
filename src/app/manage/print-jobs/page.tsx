import { requirePageRole } from "@/lib/auth";
import { PrintJobsBoard } from "@/components/print-jobs-board";

export const dynamic = "force-dynamic";

export default async function PrintJobsPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  return (
    <div>
      <h1 className="page-title">จัดการคิวพิมพ์</h1>
      <p className="page-subtitle">ดูคิวพิมพ์และกรองตาม channel/target สำหรับหลายเครื่องพิมพ์</p>
      <PrintJobsBoard />
    </div>
  );
}
