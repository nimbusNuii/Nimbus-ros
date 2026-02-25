import { InventoryReason } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";

const VALID_REASONS: InventoryReason[] = ["SALE", "ADJUST", "RESTOCK"];

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const reason = searchParams.get("reason") as InventoryReason | null;
  const productId = searchParams.get("productId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(3000, Number(searchParams.get("limit") || "1000"));

  const logs = await prisma.inventoryLog.findMany({
    where: {
      reason: reason && VALID_REASONS.includes(reason) ? reason : undefined,
      productId: productId || undefined,
      createdAt:
        from || to
          ? {
              gte: from ? new Date(`${from}T00:00:00`) : undefined,
              lte: to ? new Date(`${to}T23:59:59`) : undefined
            }
          : undefined
    },
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

  const header = ["createdAt", "reason", "productId", "productName", "sku", "deltaQty", "orderNumber", "actor", "note"];
  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.reason,
    log.productId,
    log.product.name,
    log.product.sku || "",
    log.deltaQty,
    log.order?.orderNumber || "",
    log.actor || "",
    log.note || ""
  ]);

  const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=inventory-logs.csv"
    }
  });
}
