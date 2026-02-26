import { NextResponse } from "next/server";
import type { CustomerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      name?: string;
      type?: CustomerType;
      phone?: string | null;
      note?: string | null;
      isActive?: boolean;
    };

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        type: body.type,
        phone: body.phone !== undefined ? body.phone?.trim() || null : undefined,
        note: body.note !== undefined ? body.note?.trim() || null : undefined,
        isActive: body.isActive
      }
    });

    await writeAuditLog({
      action: "CUSTOMER_UPDATED",
      entity: "Customer",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: updated.name,
        type: updated.type,
        phone: updated.phone,
        isActive: updated.isActive
      }
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Cannot update customer" }, { status: 400 });
  }
}
