import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin, requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseLimit, parsePage } from "@/lib/query-utils";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams, 200, 500);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;

  const users = await prisma.appUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    skip,
    take: limit
  });

  return NextResponse.json(
    users.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  );
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      username?: string;
      fullName?: string;
      role?: "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";
      pin?: string;
      isActive?: boolean;
    };

    const username = body.username?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const pin = body.pin?.trim();

    if (!username || !fullName || !pin || pin.length < 4 || !body.role) {
      return NextResponse.json({ error: "username/fullName/role/pin(>=4) are required" }, { status: 400 });
    }

    const existing = await prisma.appUser.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const created = await prisma.appUser.create({
      data: {
        username,
        fullName,
        role: body.role,
        pinHash: hashPin(pin),
        isActive: body.isActive ?? true
      }
    });

    await writeAuditLog({
      action: "USER_CREATED",
      entity: "AppUser",
      entityId: created.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        username: created.username,
        role: created.role,
        isActive: created.isActive
      }
    });

    return NextResponse.json({
      id: created.id,
      username: created.username,
      fullName: created.fullName,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    });
  } catch {
    return NextResponse.json({ error: "Cannot create user" }, { status: 400 });
  }
}
