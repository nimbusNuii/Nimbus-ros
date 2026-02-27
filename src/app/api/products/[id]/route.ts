import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { publishRealtime } from "@/lib/realtime";
import { normalizeImageValue } from "@/lib/image-data-url";

type ProductUpdateBody = {
  sku?: string | null;
  name?: string;
  categoryId?: string | null;
  category?: string | null;
  imageData?: string | null;
  imageUrl?: string | null;
  price?: number;
  cost?: number;
  stockQty?: number;
  isActive?: boolean;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as ProductUpdateBody;
    if (!body.name || body.price === undefined || body.cost === undefined) {
      return NextResponse.json({ error: "name, price and cost are required" }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      include: {
        categoryRef: {
          select: { id: true, name: true }
        }
      }
    });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const categoryId = body.categoryId?.trim() || null;
    let categoryName = body.category?.trim() || null;

    if (categoryId) {
      const category = await prisma.productCategory.findUnique({
        where: { id: categoryId }
      });
      if (!category || !category.isActive) {
        return NextResponse.json({ error: "ไม่พบหมวดหมู่ หรือหมวดหมู่ถูกปิดใช้งาน" }, { status: 404 });
      }
      categoryName = category.name;
    }

    let imageUrl = existing.imageUrl;
    if (body.imageData !== undefined || body.imageUrl !== undefined) {
      const rawValue = body.imageData ?? body.imageUrl ?? "";
      imageUrl = normalizeImageValue(rawValue);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        sku: body.sku?.trim() || null,
        name: body.name.trim(),
        categoryId,
        category: categoryName,
        imageUrl,
        price: Number(body.price),
        cost: Number(body.cost),
        stockQty: Math.max(0, Math.floor(Number(body.stockQty) || 0)),
        isActive: body.isActive ?? existing.isActive
      },
      include: {
        categoryRef: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    await writeAuditLog({
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        before: {
          sku: existing.sku,
          name: existing.name,
          categoryId: existing.categoryId,
          category: existing.categoryRef?.name || existing.category,
          imageUrl: existing.imageUrl,
          price: toNumber(existing.price),
          cost: toNumber(existing.cost),
          stockQty: existing.stockQty,
          isActive: existing.isActive
        },
        after: {
          sku: updated.sku,
          name: updated.name,
          categoryId: updated.categoryId,
          category: updated.categoryRef?.name || updated.category,
          imageUrl: updated.imageUrl,
          price: toNumber(updated.price),
          cost: toNumber(updated.cost),
          stockQty: updated.stockQty,
          isActive: updated.isActive
        }
      }
    });

    publishRealtime("product.updated", {
      productId: updated.id,
      action: "UPDATED"
    });

    return NextResponse.json({
      ...updated,
      category: updated.categoryRef?.name || updated.category,
      price: toNumber(updated.price),
      cost: toNumber(updated.cost)
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "SKU นี้ถูกใช้แล้ว" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot update product" },
      { status: 400 }
    );
  }
}
