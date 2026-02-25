import { KitchenStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATES: KitchenStatus[] = ["NEW", "PREPARING", "READY", "SERVED"];

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["KITCHEN", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const items = await prisma.orderItem.findMany({
    where: {
      kitchenState: {
        in: ["NEW", "PREPARING", "READY"]
      },
      order: {
        status: "PAID"
      }
    },
    include: {
      order: true
    },
    orderBy: [
      { kitchenState: "asc" },
      { createdAt: "asc" }
    ]
  });

  return NextResponse.json(
    items.map((item) => ({
      id: item.id,
      name: item.nameSnapshot,
      qty: item.qty,
      note: item.note,
      kitchenState: item.kitchenState,
      order: {
        id: item.order.id,
        orderNumber: item.order.orderNumber,
        createdAt: item.order.createdAt,
        total: toNumber(item.order.total)
      }
    }))
  );
}

export async function PATCH(request: Request) {
  const auth = requireApiRole(request, ["KITCHEN", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as { itemId?: string; kitchenState?: KitchenStatus };

    if (!body.itemId || !body.kitchenState || !VALID_STATES.includes(body.kitchenState)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await prisma.orderItem.update({
      where: { id: body.itemId },
      data: { kitchenState: body.kitchenState }
    });

    await writeAuditLog({
      action: "KITCHEN_STATE_UPDATED",
      entity: "OrderItem",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        kitchenState: updated.kitchenState
      }
    });

    return NextResponse.json({ id: updated.id, kitchenState: updated.kitchenState });
  } catch {
    return NextResponse.json({ error: "Cannot update kitchen state" }, { status: 400 });
  }
}
