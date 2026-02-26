import { requirePageRole } from "@/lib/auth";
import { PrintJobsBoard } from "@/components/print-jobs-board";

export const dynamic = "force-dynamic";

export default async function PrintJobsPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  return (
    <div>
      <PrintJobsBoard />
    </div>
  );
}
