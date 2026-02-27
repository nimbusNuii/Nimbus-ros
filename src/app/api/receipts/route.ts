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
  const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit") || "100")));

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
    select: {
      id: true,
      orderNumber: true,
      paymentMethod: true,
      status: true,
      customerType: true,
      customerName: true,
      scheduledFor: true,
      createdAt: true,
      subtotal: true,
      discount: true,
      tax: true,
      total: true
    }
  });

  const orderIds = orders.map((order) => order.id);
  const qtyByOrderId = new Map<string, number>();

  if (orderIds.length > 0) {
    const qtyGroups = await prisma.orderItem.groupBy({
      by: ["orderId"],
      where: {
        orderId: {
          in: orderIds
        }
      },
      _sum: {
        qty: true
      }
    });

    for (const group of qtyGroups) {
      qtyByOrderId.set(group.orderId, group._sum.qty ?? 0);
    }
  }

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
      itemCount: qtyByOrderId.get(order.id) ?? 0
    }))
  );
}
