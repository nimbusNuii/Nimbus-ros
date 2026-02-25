import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  let template = await prisma.receiptTemplate.findFirst({ where: { isDefault: true } });

  if (!template) {
    template = await prisma.receiptTemplate.findFirst();
  }

  if (!template) {
    template = await prisma.receiptTemplate.create({
      data: {
        name: "Default Receipt",
        isDefault: true
      }
    });
  }

  return NextResponse.json(template);
}

export async function PUT(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      headerText?: string;
      footerText?: string;
      showStoreInfo?: boolean;
      showVatNumber?: boolean;
      showCostBreakdown?: boolean;
      paperWidth?: number;
      customCss?: string;
      isDefault?: boolean;
    };

    const existing = body.id
      ? await prisma.receiptTemplate.findUnique({ where: { id: body.id } })
      : await prisma.receiptTemplate.findFirst({ where: { isDefault: true } });

    if (body.isDefault) {
      await prisma.receiptTemplate.updateMany({
        data: { isDefault: false },
        where: {}
      });
    }

    const payload = {
      name: body.name?.trim() || "Default Receipt",
      headerText: body.headerText ?? "ขอบคุณที่ใช้บริการ",
      footerText: body.footerText ?? "ขอบคุณที่อุดหนุน",
      showStoreInfo: body.showStoreInfo ?? true,
      showVatNumber: body.showVatNumber ?? true,
      showCostBreakdown: body.showCostBreakdown ?? false,
      paperWidth: body.paperWidth === 58 ? 58 : 80,
      customCss: body.customCss?.trim() || null,
      isDefault: body.isDefault ?? true
    };

    const updated = existing
      ? await prisma.receiptTemplate.update({
          where: { id: existing.id },
          data: payload
        })
      : await prisma.receiptTemplate.create({
          data: payload
        });

    await writeAuditLog({
      action: "RECEIPT_TEMPLATE_UPDATED",
      entity: "ReceiptTemplate",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: updated.name,
        paperWidth: updated.paperWidth,
        showStoreInfo: updated.showStoreInfo,
        showVatNumber: updated.showVatNumber,
        showCostBreakdown: updated.showCostBreakdown
      }
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Cannot save receipt template" }, { status: 400 });
  }
}
