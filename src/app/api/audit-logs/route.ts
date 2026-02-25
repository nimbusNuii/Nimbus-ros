import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const entity = searchParams.get("entity");
  const actorUserId = searchParams.get("actorUserId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit") || "120")));

  const logs = await prisma.auditLog.findMany({
    where: {
      action: action || undefined,
      entity: entity || undefined,
      actorUserId: actorUserId || undefined,
      createdAt:
        from || to
          ? {
              gte: from ? new Date(`${from}T00:00:00`) : undefined,
              lte: to ? new Date(`${to}T23:59:59`) : undefined
            }
          : undefined
    },
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json(logs);
}
