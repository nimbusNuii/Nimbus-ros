import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const withDb = searchParams.get("db") === "1";

  if (!withDb) {
    return NextResponse.json({
      ok: true,
      service: "nextjs-pos-postgres",
      now: new Date().toISOString()
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      now: new Date().toISOString()
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        now: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
