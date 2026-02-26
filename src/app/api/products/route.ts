import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  return NextResponse.json(
    products.map((product) => ({
      ...product,
      price: toNumber(product.price),
      cost: toNumber(product.cost)
    }))
  );
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      sku?: string;
      name?: string;
      category?: string;
      imageUrl?: string;
      price?: number;
      cost?: number;
      stockQty?: number;
    };

    if (!body.name || body.price === undefined || body.cost === undefined) {
      return NextResponse.json({ error: "name, price and cost are required" }, { status: 400 });
    }

    const created = await prisma.product.create({
      data: {
        sku: body.sku?.trim() || null,
        name: body.name.trim(),
        category: body.category?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        price: Number(body.price),
        cost: Number(body.cost),
        stockQty: Math.max(0, Math.floor(Number(body.stockQty) || 0))
      }
    });

    await writeAuditLog({
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: created.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: created.name,
        sku: created.sku,
        imageUrl: created.imageUrl,
        price: toNumber(created.price),
        cost: toNumber(created.cost),
        stockQty: created.stockQty
      }
    });

    return NextResponse.json({
      ...created,
      price: toNumber(created.price),
      cost: toNumber(created.cost)
    });
  } catch {
    return NextResponse.json({ error: "Cannot create product" }, { status: 400 });
  }
}
