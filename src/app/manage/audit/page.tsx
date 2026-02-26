import { requirePageRole } from "@/lib/auth";
import { AuditLogBoard } from "@/components/audit-log-board";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  return (
    <div>
      <AuditLogBoard />
    </div>
  );
}
