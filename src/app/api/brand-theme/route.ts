import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.storeSetting.findUnique({
    where: { id: 1 },
    select: {
      appThemeKey: true,
      brandPrimary: true,
      brandAccent: true,
      receiptLogoUrl: true
    }
  });

  return NextResponse.json(
    {
      appThemeKey: settings?.appThemeKey || "sandstone",
      brandPrimary: settings?.brandPrimary || "#b24a2b",
      brandAccent: settings?.brandAccent || "#8f381f",
      receiptLogoUrl: settings?.receiptLogoUrl || null
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400"
      }
    }
  );
}
