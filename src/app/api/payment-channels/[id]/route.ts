import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
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
      type?: PaymentMethod;
      bankName?: string | null;
      accountNumber?: string | null;
      accountName?: string | null;
      qrCodeUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    };

    const existing = await prisma.paymentChannel.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Payment channel not found" }, { status: 404 });
    }

    const updated = await prisma.paymentChannel.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        type: body.type,
        bankName: body.bankName !== undefined ? body.bankName?.trim() || null : undefined,
        accountNumber: body.accountNumber !== undefined ? body.accountNumber?.trim() || null : undefined,
        accountName: body.accountName !== undefined ? body.accountName?.trim() || null : undefined,
        qrCodeUrl: body.qrCodeUrl !== undefined ? body.qrCodeUrl?.trim() || null : undefined,
        sortOrder: body.sortOrder,
        isActive: body.isActive
      }
    });

    await writeAuditLog({
      action: "PAYMENT_CHANNEL_UPDATED",
      entity: "PaymentChannel",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: updated.name,
        type: updated.type,
        bankName: updated.bankName,
        isActive: updated.isActive
      }
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Cannot update payment channel" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const existing = await prisma.paymentChannel.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Payment channel not found" }, { status: 404 });
    }

    await prisma.paymentChannel.delete({ where: { id } });

    await writeAuditLog({
      action: "PAYMENT_CHANNEL_DELETED",
      entity: "PaymentChannel",
      entityId: id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: existing.name,
        type: existing.type
      }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Cannot delete payment channel" }, { status: 400 });
  }
}
