import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPin, requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      fullName?: string;
      role?: "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";
      pin?: string;
      isActive?: boolean;
    };

    const existing = await prisma.appUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existing.username === "admin" && body.isActive === false) {
      return NextResponse.json({ error: "Cannot deactivate default admin" }, { status: 400 });
    }

    const data: {
      fullName?: string;
      role?: "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";
      pinHash?: string;
      isActive?: boolean;
    } = {};

    if (body.fullName !== undefined) data.fullName = body.fullName.trim();
    if (body.role !== undefined) data.role = body.role;
    if (body.pin !== undefined) {
      const pin = body.pin.trim();
      if (pin.length < 4) {
        return NextResponse.json({ error: "PIN must be at least 4 chars" }, { status: 400 });
      }
      data.pinHash = hashPin(pin);
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await prisma.appUser.update({
      where: { id },
      data
    });

    await writeAuditLog({
      action: "USER_UPDATED",
      entity: "AppUser",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive,
        pinChanged: Boolean(body.pin !== undefined)
      }
    });

    return NextResponse.json({
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    });
  } catch {
    return NextResponse.json({ error: "Cannot update user" }, { status: 400 });
  }
}
