import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { toNumber } from "@/lib/format";
import { buildReceiptPdfWithPdfmake } from "@/lib/receipt-pdfmake";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true
    }
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const [store, template] = await Promise.all([
    prisma.storeSetting.findUnique({ where: { id: 1 } }),
    prisma.receiptTemplate.findFirst({ where: { isDefault: true } })
  ]);

  const pdf = await buildReceiptPdfWithPdfmake({
    order: {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      subtotal: toNumber(order.subtotal),
      discount: toNumber(order.discount),
      tax: toNumber(order.tax),
      total: toNumber(order.total),
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        qty: item.qty,
        lineTotal: toNumber(item.lineTotal),
        unitCost: toNumber(item.unitCost)
      }))
    },
    store: {
      businessName: store?.businessName || "POS Shop",
      branchName: store?.branchName || null,
      address: store?.address || null,
      phone: store?.phone || null,
      vatNumber: store?.vatNumber || null,
      currency: store?.currency || "THB"
    },
    template: {
      headerText: template?.headerText || "{{businessName}}",
      footerText: template?.footerText || "ขอบคุณที่อุดหนุน",
      showStoreInfo: template?.showStoreInfo ?? true,
      showVatNumber: template?.showVatNumber ?? true,
      showCostBreakdown: template?.showCostBreakdown ?? false,
      paperWidth: template?.paperWidth ?? 80
    }
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="receipt-${order.orderNumber}.pdf"`,
      "cache-control": "no-store"
    }
  });
}
