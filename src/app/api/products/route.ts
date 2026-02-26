import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { publishRealtime } from "@/lib/realtime";
import { parseBooleanFlag, parseLimit } from "@/lib/query-utils";

const DATA_URL_IMAGE_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i;
const MAX_IMAGE_DATA_LENGTH = 450_000;

function normalizeImageValue(raw?: string) {
  const value = raw?.trim() || "";
  if (!value) return null;

  if (value.startsWith("data:image/")) {
    if (!DATA_URL_IMAGE_PATTERN.test(value)) {
      throw new Error("Invalid base64 image");
    }
    if (value.length > MAX_IMAGE_DATA_LENGTH) {
      throw new Error("Image too large");
    }
    return value;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  throw new Error("Unsupported image format");
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;
  const { searchParams } = new URL(request.url);
  const activeOnly = parseBooleanFlag(searchParams, "active");
  const limit = parseLimit(searchParams, 300, 1000);

  const products = await prisma.product.findMany({
    where: activeOnly
      ? {
          isActive: true
        }
      : undefined,
    include: {
      categoryRef: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    take: limit
  });

  return NextResponse.json(
    products.map((product) => ({
      ...product,
      categoryId: product.categoryId,
      category: product.categoryRef?.name || product.category || null,
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
      categoryId?: string;
      category?: string;
      imageData?: string;
      imageUrl?: string;
      price?: number;
      cost?: number;
      stockQty?: number;
    };

    if (!body.name || body.price === undefined || body.cost === undefined) {
      return NextResponse.json({ error: "name, price and cost are required" }, { status: 400 });
    }

    const imageValue = normalizeImageValue(body.imageData || body.imageUrl);
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

    const created = await prisma.product.create({
      data: {
        sku: body.sku?.trim() || null,
        name: body.name.trim(),
        categoryId,
        category: categoryName,
        imageUrl: imageValue,
        price: Number(body.price),
        cost: Number(body.cost),
        stockQty: Math.max(0, Math.floor(Number(body.stockQty) || 0))
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
        categoryId: created.categoryId,
        category: created.categoryRef?.name || created.category,
        imageUrl: created.imageUrl,
        price: toNumber(created.price),
        cost: toNumber(created.cost),
        stockQty: created.stockQty
      }
    });

    publishRealtime("product.updated", {
      productId: created.id,
      action: "CREATED"
    });

    return NextResponse.json({
      ...created,
      category: created.categoryRef?.name || created.category,
      price: toNumber(created.price),
      cost: toNumber(created.cost)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cannot create product" },
      { status: 400 }
    );
  }
}
