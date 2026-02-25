import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

async function getOrCreate() {
  return prisma.storeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      businessName: "POS Shop",
      taxRate: 7,
      currency: "THB"
    }
  });
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const settings = await getOrCreate();
  return NextResponse.json({
    ...settings,
    taxRate: toNumber(settings.taxRate)
  });
}

export async function PUT(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      businessName?: string;
      branchName?: string;
      address?: string;
      phone?: string;
      vatNumber?: string;
      taxRate?: number;
      currency?: string;
    };

    const updated = await prisma.storeSetting.upsert({
      where: { id: 1 },
      update: {
        businessName: body.businessName?.trim(),
        branchName: body.branchName?.trim() || null,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        vatNumber: body.vatNumber?.trim() || null,
        taxRate: Number(body.taxRate ?? 7),
        currency: body.currency?.trim() || "THB"
      },
      create: {
        id: 1,
        businessName: body.businessName?.trim() || "POS Shop",
        branchName: body.branchName?.trim() || null,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        vatNumber: body.vatNumber?.trim() || null,
        taxRate: Number(body.taxRate ?? 7),
        currency: body.currency?.trim() || "THB"
      }
    });

    await writeAuditLog({
      action: "STORE_SETTINGS_UPDATED",
      entity: "StoreSetting",
      entityId: String(updated.id),
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        businessName: updated.businessName,
        taxRate: toNumber(updated.taxRate),
        currency: updated.currency
      }
    });

    return NextResponse.json({
      ...updated,
      taxRate: toNumber(updated.taxRate)
    });
  } catch {
    return NextResponse.json({ error: "Cannot update store settings" }, { status: 400 });
  }
}
