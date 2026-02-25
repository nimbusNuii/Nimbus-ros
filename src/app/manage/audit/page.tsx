import { requirePageRole } from "@/lib/auth";
import { AuditLogBoard } from "@/components/audit-log-board";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  return (
    <div>
      <h1 className="page-title">Audit Log</h1>
      <p className="page-subtitle">ตรวจสอบว่าใครทำอะไร เมื่อไหร่ และกระทบข้อมูลไหน</p>
      <AuditLogBoard />
    </div>
  );
}
