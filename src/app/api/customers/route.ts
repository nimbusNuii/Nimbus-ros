import { NextResponse } from "next/server";
import { Prisma, type CustomerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseBooleanFlag, parseLimit, parsePage } from "@/lib/query-utils";

type CustomerSort = "active_type_name" | "name_asc" | "name_desc" | "created_desc" | "created_asc";

function parseSort(value: string | null): CustomerSort {
  const allowed: CustomerSort[] = ["active_type_name", "name_asc", "name_desc", "created_desc", "created_asc"];
  return value && allowed.includes(value as CustomerSort) ? (value as CustomerSort) : "active_type_name";
}

function orderByFromSort(sort: CustomerSort): Prisma.CustomerOrderByWithRelationInput[] {
  if (sort === "name_asc") return [{ name: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }];
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;
  const { searchParams } = new URL(request.url);
  const activeOnly = parseBooleanFlag(searchParams, "active");
  const typeParam = searchParams.get("type");
  const type = typeParam === "WALK_IN" || typeParam === "REGULAR" ? (typeParam as CustomerType) : undefined;
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const sort = parseSort(searchParams.get("sort"));
  const limit = parseLimit(searchParams, 300, 1000);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;
  const where: Prisma.CustomerWhereInput = {
    isActive: activeOnly ? true : undefined,
    type,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { note: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const customers = await prisma.customer.findMany({
    where,
    orderBy: orderByFromSort(sort),
    skip,
    take: limit
  });

  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      name?: string;
      type?: CustomerType;
      phone?: string;
      note?: string;
      isActive?: boolean;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const created = await prisma.customer.create({
      data: {
        name,
        type: body.type === "WALK_IN" ? "WALK_IN" : "REGULAR",
        phone: body.phone?.trim() || null,
        note: body.note?.trim() || null,
        isActive: body.isActive ?? true
      }
    });

    await writeAuditLog({
      action: "CUSTOMER_CREATED",
      entity: "Customer",
      entityId: created.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: created.name,
        type: created.type,
        phone: created.phone,
        isActive: created.isActive
      }
    });

    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "Cannot create customer" }, { status: 400 });
  }
}
