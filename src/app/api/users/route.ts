import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPin, requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseLimit, parsePage } from "@/lib/query-utils";

type UserSort = "role_username" | "username_asc" | "username_desc" | "created_desc" | "created_asc";

function parseSort(value: string | null): UserSort {
  const allowed: UserSort[] = ["role_username", "username_asc", "username_desc", "created_desc", "created_asc"];
  return value && allowed.includes(value as UserSort) ? (value as UserSort) : "role_username";
}

function orderByFromSort(sort: UserSort): Prisma.AppUserOrderByWithRelationInput[] {
  if (sort === "username_asc") return [{ username: "asc" }];
  if (sort === "username_desc") return [{ username: "desc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ role: "asc" }, { username: "asc" }];
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const sort = parseSort(searchParams.get("sort"));
  const limit = parseLimit(searchParams, 200, 500);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;
  const where: Prisma.AppUserWhereInput | undefined = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } }
        ]
      }
    : undefined;

  const users = await prisma.appUser.findMany({
    where,
    orderBy: orderByFromSort(sort),
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
