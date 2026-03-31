import { PaymentChannelManager } from "@/components/payment-channel-manager";
import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ManagePaymentChannelsPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const channels = await prisma.paymentChannel.findMany({
    orderBy: [{ isActive: "desc" }, { type: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
  });

  return (
    <div>
      <PaymentChannelManager initialChannels={channels} />
    </div>
  );
}
