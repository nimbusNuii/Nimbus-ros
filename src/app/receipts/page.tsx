import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReceiptHistoryBoard } from "@/components/receipt-history-board";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  await requirePageRole(["CASHIER", "MANAGER", "ADMIN"]);

  const setting = await prisma.storeSetting.findUnique({ where: { id: 1 } });

  return (
    <div>
      <ReceiptHistoryBoard currency={setting?.currency || "THB"} />
    </div>
  );
}
