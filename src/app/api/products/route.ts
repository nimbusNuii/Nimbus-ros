import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { publishRealtime } from "@/lib/realtime";
import { parseBooleanFlag, parseLimit, parsePage } from "@/lib/query-utils";
import { normalizeImageValue } from "@/lib/image-data-url";
type ProductSort = "category_name" | "name_asc" | "name_desc" | "stock_asc" | "stock_desc" | "price_asc" | "price_desc";

function parseSort(value: string | null): ProductSort {
  const allowed: ProductSort[] = [
    "category_name",
    "name_asc",
    "name_desc",
    "stock_asc",
    "stock_desc",
    "price_asc",
    "price_desc"
  ];
  return value && allowed.includes(value as ProductSort) ? (value as ProductSort) : "category_name";
}

function orderByFromSort(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "name_asc") return [{ name: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }];
  if (sort === "stock_asc") return [{ stockQty: "asc" }, { name: "asc" }];
  if (sort === "stock_desc") return [{ stockQty: "desc" }, { name: "asc" }];
  if (sort === "price_asc") return [{ price: "asc" }, { name: "asc" }];
  if (sort === "price_desc") return [{ price: "desc" }, { name: "asc" }];
  return [{ category: "asc" }, { name: "asc" }];
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;
  const { searchParams } = new URL(request.url);
  const activeOnly = parseBooleanFlag(searchParams, "active");
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const sort = parseSort(searchParams.get("sort"));
  const limit = parseLimit(searchParams, 300, 1000);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;
  const where: Prisma.ProductWhereInput = {
    isActive: activeOnly ? true : undefined,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      categoryRef: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: orderByFromSort(sort),
    skip,
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
