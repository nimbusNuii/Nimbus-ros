import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { parseLimit, parsePage } from "@/lib/query-utils";

type AuditSort = "created_desc" | "created_asc";

function parseSort(value: string | null): AuditSort {
  return value === "created_asc" ? "created_asc" : "created_desc";
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const entity = searchParams.get("entity");
  const actorUserId = searchParams.get("actorUserId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const sort = parseSort(searchParams.get("sort"));
  const withMeta = searchParams.get("withMeta") === "1";
  const limit = parseLimit(searchParams, 120, 300);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    action: action || undefined,
    entity: entity || undefined,
    actorUserId: actorUserId || undefined,
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
            { action: { contains: q, mode: "insensitive" } },
            { entity: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q, mode: "insensitive" } },
            { actorUsername: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: sort === "created_asc" ? "asc" : "desc" },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true
          }
        }
      }
    }),
    prisma.auditLog.count({ where })
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
