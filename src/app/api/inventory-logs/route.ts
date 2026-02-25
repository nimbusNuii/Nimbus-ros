import { InventoryReason } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";

const VALID_REASONS: InventoryReason[] = ["SALE", "ADJUST", "RESTOCK"];

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const reason = searchParams.get("reason") as InventoryReason | null;
  const productId = searchParams.get("productId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(300, Number(searchParams.get("limit") || "100"));

  const where = {
    reason: reason && VALID_REASONS.includes(reason) ? reason : undefined,
    productId: productId || undefined,
    createdAt:
      from || to
        ? {
            gte: from ? new Date(`${from}T00:00:00`) : undefined,
            lte: to ? new Date(`${to}T23:59:59`) : undefined
          }
        : undefined
  };

  const logs = await prisma.inventoryLog.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true
        }
      },
      order: {
        select: {
          id: true,
          orderNumber: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return NextResponse.json(logs);
}
