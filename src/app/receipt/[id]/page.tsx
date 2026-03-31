import { notFound } from "next/navigation";
import { ReceiptDocument } from "@/components/receipt-document";
import { ReceiptActions } from "@/components/receipt-actions";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["CASHIER", "MANAGER", "ADMIN"]);

  const { id } = await params;

  const [order, template, store] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { items: true } }),
    prisma.receiptTemplate.findFirst({ where: { isDefault: true } }),
    prisma.storeSetting.findUnique({ where: { id: 1 } }),
  ]);

  if (!order) {
    notFound();
  }

  const finalTemplate =
    template ||
    (await prisma.receiptTemplate.create({
      data: {
        name: "Default Receipt",
        isDefault: true
      }
    }));

  const finalStore =
    store ||
    (await prisma.storeSetting.create({
      data: {
        id: 1,
        businessName: "POS Shop",
        vatEnabled: true,
        taxRate: 7,
        currency: "THB"
      }
    }));

  return (
    <div>
      <ReceiptActions orderId={order.id} />

      <ReceiptDocument
        order={{
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          paymentMethod: order.paymentMethod,
          subtotal: toNumber(order.subtotal),
          discount: toNumber(order.discount),
          tax: toNumber(order.tax),
          total: toNumber(order.total),
          items: order.items.map((item) => ({
            id: item.id,
            name: item.nameSnapshot,
            qty: item.qty,
            unitPrice: toNumber(item.unitPrice),
            unitCost: toNumber(item.unitCost),
            lineTotal: toNumber(item.lineTotal)
          }))
        }}
        store={{
          businessName: finalStore.businessName,
          branchName: finalStore.branchName,
          address: finalStore.address,
          phone: finalStore.phone,
          vatNumber: finalStore.vatNumber,
          receiptLogoUrl: finalStore.receiptLogoUrl,
          currency: finalStore.currency
        }}
        template={{
          headerText: finalTemplate.headerText,
          footerText: finalTemplate.footerText,
          showStoreInfo: finalTemplate.showStoreInfo,
          showVatNumber: finalTemplate.showVatNumber,
          showCostBreakdown: finalTemplate.showCostBreakdown,
          paperWidth: finalTemplate.paperWidth,
          customCss: finalTemplate.customCss
        }}
      />
    </div>
  );
}
