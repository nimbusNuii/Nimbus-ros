import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { toNumber } from "@/lib/format";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || "100")));

  const orders = await prisma.order.findMany({
    where: {
      status:
        status && ["PAID", "OPEN", "CANCELLED"].includes(status)
          ? (status as "PAID" | "OPEN" | "CANCELLED")
          : undefined,
      createdAt:
        from || to
          ? {
              gte: from ? new Date(`${from}T00:00:00`) : undefined,
              lte: to ? new Date(`${to}T23:59:59`) : undefined
            }
          : undefined
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    include: {
      items: {
        select: {
          id: true,
          qty: true
        }
      }
    }
  });

  return NextResponse.json(
    orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      status: order.status,
      customerType: order.customerType,
      customerName: order.customerName,
      scheduledFor: order.scheduledFor,
      createdAt: order.createdAt,
      subtotal: toNumber(order.subtotal),
      discount: toNumber(order.discount),
      tax: toNumber(order.tax),
      total: toNumber(order.total),
      itemCount: order.items.reduce((sum, item) => sum + item.qty, 0)
    }))
  );
}
