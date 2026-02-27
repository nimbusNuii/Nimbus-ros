import { InventoryReason, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { parseLimit, parsePage } from "@/lib/query-utils";

const VALID_REASONS: InventoryReason[] = ["SALE", "ADJUST", "RESTOCK"];
type InventorySort = "created_desc" | "created_asc";

function parseSort(value: string | null): InventorySort {
  return value === "created_asc" ? "created_asc" : "created_desc";
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const reason = searchParams.get("reason") as InventoryReason | null;
  const productId = searchParams.get("productId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const sort = parseSort(searchParams.get("sort"));
  const withMeta = searchParams.get("withMeta") === "1";
  const limit = parseLimit(searchParams, 100, 300);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;

  const where: Prisma.InventoryLogWhereInput = {
    reason: reason && VALID_REASONS.includes(reason) ? reason : undefined,
    productId: productId || undefined,
    createdAt:
      from || to
        ? {
            gte: from ? new Date(`${from}T00:00:00`) : undefined,
            lte: to ? new Date(`${to}T23:59:59`) : undefined
          }
        : undefined,
    ...(q
      ? {
          OR: [
            { actor: { contains: q, mode: "insensitive" } },
            { note: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
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
        createdAt: sort === "created_asc" ? "asc" : "desc"
      },
      skip,
      take: limit
    }),
    prisma.inventoryLog.count({ where })
  ]);

  if (withMeta) {
    return NextResponse.json({
      rows: logs,
      total,
      page,
      pageSize: limit
    });
  }
  return NextResponse.json(logs);
}
