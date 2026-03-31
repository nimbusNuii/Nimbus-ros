import { NextResponse } from "next/server";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseBooleanFlag, parseLimit, parsePage } from "@/lib/query-utils";

type PaymentChannelSort = "active_type_sort" | "name_asc" | "name_desc" | "created_desc" | "created_asc";

function parseSort(value: string | null): PaymentChannelSort {
  const allowed: PaymentChannelSort[] = [
    "active_type_sort",
    "name_asc",
    "name_desc",
    "created_desc",
    "created_asc"
  ];
  return value && allowed.includes(value as PaymentChannelSort)
    ? (value as PaymentChannelSort)
    : "active_type_sort";
}

function orderByFromSort(sort: PaymentChannelSort): Prisma.PaymentChannelOrderByWithRelationInput[] {
  if (sort === "name_asc") return [{ name: "asc" }];
  if (sort === "name_desc") return [{ name: "desc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ isActive: "desc" }, { type: "asc" }, { sortOrder: "asc" }, { name: "asc" }];
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;
  const { searchParams } = new URL(request.url);
  const activeOnly = parseBooleanFlag(searchParams, "active");
  const typeParam = searchParams.get("type");
  const type =
    typeParam === "CASH" || typeParam === "CARD" || typeParam === "TRANSFER" || typeParam === "QR"
      ? (typeParam as PaymentMethod)
      : undefined;
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const sort = parseSort(searchParams.get("sort"));
  const limit = parseLimit(searchParams, 100, 500);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;
  const where: Prisma.PaymentChannelWhereInput = {
    isActive: activeOnly ? true : undefined,
    type,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { bankName: { contains: q, mode: "insensitive" } },
            { accountNumber: { contains: q, mode: "insensitive" } },
            { accountName: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const channels = await prisma.paymentChannel.findMany({
    where,
    orderBy: orderByFromSort(sort),
    skip,
    take: limit
  });

  return NextResponse.json(channels);
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      name?: string;
      type?: PaymentMethod;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
      qrCodeUrl?: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!body.type || !["CASH", "CARD", "TRANSFER", "QR"].includes(body.type)) {
      return NextResponse.json({ error: "valid type is required" }, { status: 400 });
    }

    const created = await prisma.paymentChannel.create({
      data: {
        name,
        type: body.type,
        bankName: body.bankName?.trim() || null,
        accountNumber: body.accountNumber?.trim() || null,
        accountName: body.accountName?.trim() || null,
        qrCodeUrl: body.qrCodeUrl?.trim() || null,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true
      }
    });

    await writeAuditLog({
      action: "PAYMENT_CHANNEL_CREATED",
      entity: "PaymentChannel",
      entityId: created.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        name: created.name,
        type: created.type,
        bankName: created.bankName,
        isActive: created.isActive
      }
    });

    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "Cannot create payment channel" }, { status: 400 });
  }
}
