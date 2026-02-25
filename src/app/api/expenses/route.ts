import { ExpenseType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_EXPENSE_TYPES: ExpenseType[] = ["INGREDIENT", "STAFF", "ELECTRICITY", "OTHER"];

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Number(searchParams.get("limit") || "50"));

  const expenses = await prisma.expense.findMany({
    take: limit,
    orderBy: { incurredOn: "desc" }
  });

  return NextResponse.json(
    expenses.map((expense) => ({
      ...expense,
      amount: toNumber(expense.amount)
    }))
  );
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      type?: ExpenseType;
      amount?: number;
      note?: string;
      incurredOn?: string;
    };

    if (!body.type || !VALID_EXPENSE_TYPES.includes(body.type) || body.amount === undefined) {
      return NextResponse.json({ error: "Invalid expense payload" }, { status: 400 });
    }

    const created = await prisma.expense.create({
      data: {
        type: body.type,
        amount: Number(body.amount),
        note: body.note?.trim() || null,
        incurredOn: body.incurredOn ? new Date(body.incurredOn) : new Date()
      }
    });

    await writeAuditLog({
      action: "EXPENSE_CREATED",
      entity: "Expense",
      entityId: created.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        type: created.type,
        amount: toNumber(created.amount),
        incurredOn: created.incurredOn.toISOString()
      }
    });

    return NextResponse.json({
      ...created,
      amount: toNumber(created.amount)
    });
  } catch {
    return NextResponse.json({ error: "Cannot create expense" }, { status: 400 });
  }
}
