import { MenuOptionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const TYPES: MenuOptionType[] = ["SPICE_LEVEL", "ADD_ON", "REMOVE_INGREDIENT"];

function parseType(type?: string | null): MenuOptionType | null {
  if (!type) return null;
  if (TYPES.includes(type as MenuOptionType)) {
    return type as MenuOptionType;
  }
  return null;
}

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
      type?: MenuOptionType;
      label?: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    const data: {
      type?: MenuOptionType;
      label?: string;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (body.type !== undefined) {
      const parsedType = parseType(body.type);
      if (!parsedType) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
      }
      data.type = parsedType;
    }

    if (body.label !== undefined) {
      const label = body.label.trim();
      if (!label) {
        return NextResponse.json({ error: "label cannot be empty" }, { status: 400 });
      }
      data.label = label;
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(Number(body.sortOrder) || 0);
    }

    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updated = await prisma.menuOption.update({
      where: { id },
      data
    });

    await writeAuditLog({
      action: "MENU_OPTION_UPDATED",
      entity: "MenuOption",
      entityId: updated.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        type: updated.type,
        label: updated.label,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot update option";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "ตัวเลือกนี้มีอยู่แล้ว" }, { status: 409 });
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

  const option = await prisma.menuOption.findUnique({ where: { id } });
  if (!option) {
    return NextResponse.json({ error: "Option not found" }, { status: 404 });
  }

  await prisma.menuOption.delete({ where: { id } });

  await writeAuditLog({
    action: "MENU_OPTION_DELETED",
    entity: "MenuOption",
    entityId: id,
    actor: {
      userId: auth.session?.userId,
      username: auth.session?.username,
      role: auth.session?.role
    },
    metadata: {
      type: option.type,
      label: option.label
    }
  });

  return NextResponse.json({ id });
}
