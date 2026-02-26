import { NextResponse } from "next/server";
import type { CustomerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const customers = await prisma.customer.findMany({
    orderBy: [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }]
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
