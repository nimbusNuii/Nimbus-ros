import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { buildPrintPayload, suggestedTarget } from "@/lib/print";

type UpdateAction = "CANCEL" | "MARK_PAID";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      action?: UpdateAction;
      paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "QR";
    };

    if (!body.action || !["CANCEL", "MARK_PAID"].includes(body.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (body.action === "CANCEL") {
      if (order.status === "CANCELLED") {
        return NextResponse.json({ error: "Order already cancelled" }, { status: 409 });
      }

      const stockMap = order.items.reduce<Map<string, number>>((map, item) => {
        map.set(item.productId, (map.get(item.productId) || 0) + item.qty);
        return map;
      }, new Map<string, number>());

      const updated = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED"
          }
        });

        await tx.orderItem.updateMany({
          where: {
            orderId: order.id,
            kitchenState: {
              in: ["NEW", "PREPARING", "READY"]
            }
          },
          data: {
            kitchenState: "SERVED"
          }
        });

        for (const [productId, qty] of stockMap.entries()) {
          await tx.product.update({
            where: {
              id: productId
            },
            data: {
              stockQty: { increment: qty }
            }
          });

          await tx.inventoryLog.create({
            data: {
              productId,
              orderId: cancelled.id,
              deltaQty: qty,
              reason: "RESTOCK",
              actor: auth.session?.username ?? "system",
              note: `Cancel ${cancelled.orderNumber}`
            }
          });
        }

        await writeAuditLog(
          {
            action: "ORDER_CANCELLED",
            entity: "Order",
            entityId: cancelled.id,
            actor: {
              userId: auth.session?.userId,
              username: auth.session?.username,
              role: auth.session?.role
            },
            metadata: {
              orderNumber: cancelled.orderNumber,
              previousStatus: order.status,
              restockItems: stockMap.size
            }
          },
          tx
        );

        return cancelled;
      });

      return NextResponse.json({
        id: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status
      });
    }

    if (order.status !== "OPEN") {
      return NextResponse.json({ error: "Only open orders can be marked paid" }, { status: 409 });
    }

    const [setting, template] = await Promise.all([
      prisma.storeSetting.findUnique({ where: { id: 1 } }),
      prisma.receiptTemplate.findFirst({ where: { isDefault: true } })
    ]);

    const updated = await prisma.$transaction(async (tx) => {
      const paid = await tx.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "PAID",
          paymentMethod: body.paymentMethod || order.paymentMethod,
          scheduledFor: null
        }
      });

      await tx.printJob.create({
        data: {
          orderId: paid.id,
          status: "PENDING",
          channel: "KITCHEN_TICKET",
          printerTarget: suggestedTarget("KITCHEN_TICKET"),
          payload: buildPrintPayload({
            channel: "KITCHEN_TICKET",
            businessName: setting?.businessName ?? "POS Shop",
            order: {
              id: paid.id,
              orderNumber: paid.orderNumber,
              createdAt: paid.createdAt,
              subtotal: toNumber(paid.subtotal),
              discount: toNumber(paid.discount),
              tax: toNumber(paid.tax),
              total: toNumber(paid.total),
              items: order.items.map((item) => ({
                nameSnapshot: item.nameSnapshot,
                qty: item.qty,
                lineTotal: toNumber(item.lineTotal),
                note: item.note
              }))
            },
            footerText: template?.footerText ?? "ขอบคุณที่อุดหนุน"
          })
        }
      });

      await writeAuditLog(
        {
          action: "ORDER_MARKED_PAID",
          entity: "Order",
          entityId: paid.id,
          actor: {
            userId: auth.session?.userId,
            username: auth.session?.username,
            role: auth.session?.role
          },
          metadata: {
            orderNumber: paid.orderNumber,
            previousStatus: order.status,
            paymentMethod: paid.paymentMethod
          }
        },
        tx
      );

      return paid;
    });

    return NextResponse.json({
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
      paymentMethod: updated.paymentMethod
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot update order" },
      { status: 400 }
    );
  }
}
