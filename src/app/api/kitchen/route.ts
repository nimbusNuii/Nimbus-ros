import { KitchenStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATES: KitchenStatus[] = ["NEW", "PREPARING", "READY", "SERVED"];
const ACTIVE_STATES: KitchenStatus[] = ["NEW", "PREPARING", "READY"];

function nextStateForOrder(states: KitchenStatus[]) {
  if (states.includes("NEW")) return "PREPARING" as KitchenStatus;
  if (states.includes("PREPARING")) return "READY" as KitchenStatus;
  return "SERVED" as KitchenStatus;
}

function updatableStatesForTarget(targetState: KitchenStatus): KitchenStatus[] {
  if (targetState === "PREPARING") return ["NEW"];
  if (targetState === "READY") return ["NEW", "PREPARING"];
  if (targetState === "SERVED") return ACTIVE_STATES;
  return [];
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["KITCHEN", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const items = await prisma.orderItem.findMany({
    where: {
      kitchenState: {
        in: ["NEW", "PREPARING", "READY"]
      },
      order: {
        status: {
          in: ["PAID", "OPEN"]
        }
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
        customerType: item.order.customerType,
        customerName: item.order.customerName,
        total: toNumber(item.order.total)
      }
    }))
  );
}

export async function PATCH(request: Request) {
  const auth = requireApiRole(request, ["KITCHEN", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as { itemId?: string; orderId?: string; kitchenState?: KitchenStatus };

    if (body.orderId) {
      const orderItems = await prisma.orderItem.findMany({
        where: {
          orderId: body.orderId,
          kitchenState: {
            in: ACTIVE_STATES
          }
        },
        select: {
          id: true,
          kitchenState: true
        }
      });

      if (orderItems.length === 0) {
        return NextResponse.json({ error: "Order has no active kitchen items" }, { status: 404 });
      }

      const targetState =
        body.kitchenState && VALID_STATES.includes(body.kitchenState)
          ? body.kitchenState
          : nextStateForOrder(orderItems.map((item) => item.kitchenState));

      const updatableStates = updatableStatesForTarget(targetState);
      if (updatableStates.length === 0) {
        return NextResponse.json({ error: "Invalid order target state" }, { status: 400 });
      }

      const updated = await prisma.orderItem.updateMany({
        where: {
          orderId: body.orderId,
          kitchenState: {
            in: updatableStates
          }
        },
        data: {
          kitchenState: targetState
        }
      });

      await writeAuditLog({
        action: "KITCHEN_ORDER_STATE_UPDATED",
        entity: "Order",
        entityId: body.orderId,
        actor: {
          userId: auth.session?.userId,
          username: auth.session?.username,
          role: auth.session?.role
        },
        metadata: {
          kitchenState: targetState,
          fromStates: updatableStates,
          updatedItems: updated.count
        }
      });

      return NextResponse.json({
        orderId: body.orderId,
        kitchenState: targetState,
        updatedItems: updated.count
      });
    }

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
