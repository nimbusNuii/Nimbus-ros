import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { toNumber } from "@/lib/format";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      OR: [
        { customerId: id },
        {
          customerId: null,
          customerType: customer.type,
          customerName: customer.name
        }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      items: {
        select: {
          qty: true
        }
      }
    }
  });

  const rows = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    total: toNumber(order.total)
  }));

  const totalSpent = rows.reduce((sum, row) => sum + row.total, 0);
  const totalOrders = rows.length;

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      type: customer.type
    },
    summary: {
      totalOrders,
      totalSpent,
      averageOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      lastOrderAt: rows[0]?.createdAt || null
    },
    rows
  });
}
