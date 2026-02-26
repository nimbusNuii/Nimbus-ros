import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getOrCreateStore() {
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

export async function GET() {
  const settings = await getOrCreateStore();

  return NextResponse.json({
    appThemeKey: settings.appThemeKey || "sandstone",
    brandPrimary: settings.brandPrimary || "#b24a2b",
    brandAccent: settings.brandAccent || "#8f381f",
    receiptLogoUrl: settings.receiptLogoUrl || null
  });
}
