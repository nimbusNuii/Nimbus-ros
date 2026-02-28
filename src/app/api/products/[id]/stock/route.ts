import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { publishRealtime } from "@/lib/realtime";
import { runTransaction } from "@/lib/transaction";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      deltaQty?: number;
      note?: string;
      reason?: "ADJUST" | "RESTOCK";
    };

    const deltaQty = Math.trunc(Number(body.deltaQty) || 0);
    if (!deltaQty) {
      return NextResponse.json({ error: "deltaQty required and must not be 0" }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (deltaQty < 0 && existing.stockQty + deltaQty < 0) {
      return NextResponse.json({ error: "Stock cannot be negative" }, { status: 409 });
    }

    const updated = await runTransaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          stockQty: {
            increment: deltaQty
          }
        }
      });

      await tx.inventoryLog.create({
        data: {
          productId: id,
          deltaQty,
          reason: body.reason === "RESTOCK" ? "RESTOCK" : "ADJUST",
          note: body.note?.trim() || null,
          actor: auth.session?.username || "system"
        }
      });

      await writeAuditLog(
        {
          action: "PRODUCT_STOCK_ADJUSTED",
          entity: "Product",
          entityId: product.id,
          actor: {
            userId: auth.session?.userId,
            username: auth.session?.username,
            role: auth.session?.role
          },
          metadata: {
            deltaQty,
            reason: body.reason === "RESTOCK" ? "RESTOCK" : "ADJUST",
            stockAfter: product.stockQty
          }
        },
        tx
      );

      return product;
    });

    publishRealtime("stock.updated", {
      source: "stock.adjust",
      productId: updated.id,
      stockQty: updated.stockQty,
      deltaQty
    });

    return NextResponse.json({
      id: updated.id,
      stockQty: updated.stockQty
    });
  } catch {
    return NextResponse.json({ error: "Cannot update stock" }, { status: 400 });
  }
}
