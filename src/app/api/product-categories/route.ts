import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "1";

  const categories = await prisma.productCategory.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const created = await prisma.productCategory.create({
      data: {
        name,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
        isActive: body.isActive !== false
      }
    });

    await writeAuditLog({
      action: "PRODUCT_CATEGORY_CREATED",
      entity: "ProductCategory",
      entityId: created.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: created.name,
        sortOrder: created.sortOrder,
        isActive: created.isActive
      }
    });

    return NextResponse.json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot create category";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "ชื่อหมวดหมู่นี้มีอยู่แล้ว" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
