import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    const data: {
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      }
      data.name = name;
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(Number(body.sortOrder) || 0);
    }

    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data
    });

    if (data.name) {
      await prisma.product.updateMany({
        where: {
          categoryId: id
        },
        data: {
          category: data.name
        }
      });
    }

    await writeAuditLog({
      action: "PRODUCT_CATEGORY_UPDATED",
      entity: "ProductCategory",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: updated.name,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot update category";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "ชื่อหมวดหมู่นี้มีอยู่แล้ว" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const category = await prisma.productCategory.findUnique({
    where: { id },
    include: {
      products: {
        select: {
          id: true
        },
        take: 1
      }
    }
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (category.products.length > 0) {
    return NextResponse.json(
      { error: "หมวดหมู่นี้ยังถูกใช้งานอยู่ กรุณาย้ายสินค้าออกก่อนลบ" },
      { status: 409 }
    );
  }

  await prisma.productCategory.delete({ where: { id } });

  await writeAuditLog({
    action: "PRODUCT_CATEGORY_DELETED",
    entity: "ProductCategory",
    entityId: id,
    actor: {
      userId: auth.session?.userId,
      username: auth.session?.username,
      role: auth.session?.role
    },
    metadata: {
      name: category.name
    }
  });

  return NextResponse.json({ id });
}
