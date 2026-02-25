import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { buildEscPosText } from "@/lib/receipt";
import { requireApiRole } from "@/lib/auth";

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

  const payload = buildEscPosText({
    businessName: store?.businessName ?? "POS Shop",
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      qty: item.qty,
      total: toNumber(item.lineTotal)
    })),
    subtotal: toNumber(order.subtotal),
    discount: toNumber(order.discount),
    tax: toNumber(order.tax),
    total: toNumber(order.total),
    footerText: template?.footerText ?? "ขอบคุณที่อุดหนุน"
  });

  return new NextResponse(payload, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="receipt-${order.orderNumber}.txt"`
    }
  });
}
