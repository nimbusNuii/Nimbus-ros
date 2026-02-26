import { MenuOptionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseBooleanFlag, parseLimit } from "@/lib/query-utils";

const TYPES: MenuOptionType[] = ["SPICE_LEVEL", "ADD_ON", "REMOVE_INGREDIENT"];

function parseType(type?: string | null): MenuOptionType | null {
  if (!type) return null;
  if (TYPES.includes(type as MenuOptionType)) {
    return type as MenuOptionType;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "KITCHEN", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get("type"));
  const activeOnly = parseBooleanFlag(searchParams, "active");
  const limit = parseLimit(searchParams, 300, 1000);

  const options = await prisma.menuOption.findMany({
    where: {
      type: type || undefined,
      isActive: activeOnly ? true : undefined
    },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    take: limit
  });

  return NextResponse.json(options);
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      type?: MenuOptionType;
      label?: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    const type = parseType(body.type);
    const label = body.label?.trim();

    if (!type || !label) {
      return NextResponse.json({ error: "type and label are required" }, { status: 400 });
    }

    const created = await prisma.menuOption.create({
      data: {
        type,
        label,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
        isActive: body.isActive !== false
      }
    });

    await writeAuditLog({
      action: "MENU_OPTION_CREATED",
      entity: "MenuOption",
      entityId: created.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        type: created.type,
        label: created.label,
        sortOrder: created.sortOrder,
        isActive: created.isActive
      }
    });

    return NextResponse.json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot create option";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "ตัวเลือกนี้มีอยู่แล้ว" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
