import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { isAppThemeKey, type AppThemeKey } from "@/lib/app-theme-presets";

function normalizeHexColor(value: string | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function normalizeLogoUrl(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.startsWith("data:image/")) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return null;
}

async function getOrCreate() {
  return prisma.storeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      businessName: "POS Shop",
      appThemeKey: "sandstone",
      brandPrimary: "#b24a2b",
      brandAccent: "#8f381f",
      vatEnabled: true,
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
      appThemeKey?: string;
      brandPrimary?: string;
      brandAccent?: string;
      receiptLogoUrl?: string;
      vatEnabled?: boolean;
      taxRate?: number;
      currency?: string;
    };

    const requestedTheme = body.appThemeKey || "";
    const appThemeKey: AppThemeKey = isAppThemeKey(requestedTheme) ? requestedTheme : "sandstone";
    const brandPrimary = normalizeHexColor(body.brandPrimary, "#b24a2b");
    const brandAccent = normalizeHexColor(body.brandAccent, "#8f381f");
    const receiptLogoUrl = normalizeLogoUrl(body.receiptLogoUrl);

    const updated = await prisma.storeSetting.upsert({
      where: { id: 1 },
      update: {
        businessName: body.businessName?.trim(),
        branchName: body.branchName?.trim() || null,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        vatNumber: body.vatNumber?.trim() || null,
        appThemeKey,
        brandPrimary,
        brandAccent,
        receiptLogoUrl,
        vatEnabled: body.vatEnabled !== false,
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
        appThemeKey,
        brandPrimary,
        brandAccent,
        receiptLogoUrl,
        vatEnabled: body.vatEnabled !== false,
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
        appThemeKey: updated.appThemeKey,
        brandPrimary: updated.brandPrimary,
        brandAccent: updated.brandAccent,
        receiptLogoUrl: updated.receiptLogoUrl,
        vatEnabled: updated.vatEnabled,
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
