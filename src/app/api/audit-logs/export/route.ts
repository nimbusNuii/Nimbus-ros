import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function safeString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
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
  const sort = searchParams.get("sort") === "created_asc" ? "created_asc" : "created_desc";
  const limit = Math.min(3000, Math.max(1, Number(searchParams.get("limit") || "1000")));

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

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: sort === "created_asc" ? "asc" : "desc" },
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
  });

  const header = ["createdAt", "action", "entity", "entityId", "actorUsername", "actorRole", "metadata"];
  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.action,
    log.entity,
    log.entityId || "",
    log.actor?.username || log.actorUsername || "",
    log.actor?.role || log.actorRole || "",
    safeString(log.metadata)
  ]);

  const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=audit-logs.csv"
    }
  });
}
