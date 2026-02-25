import { ExpenseType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";

const MAX_DAILY_POINTS = 62;

function asDateRange(from?: string | null, to?: string | null) {
  const fromDate = from ? new Date(`${from}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
  const toDate = to ? new Date(`${to}T23:59:59`) : new Date(new Date().setHours(23, 59, 59, 999));
  return { fromDate, toDate };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, diff));
}

type ProfitPoint = {
  label: string;
  sales: number;
  expense: number;
  netProfit: number;
};

export async function calculateSummary(from?: string | null, to?: string | null) {
  const { fromDate, toDate } = asDateRange(from, to);

  const orderWhere: Prisma.OrderWhereInput = {
    status: "PAID",
    createdAt: {
      gte: fromDate,
      lte: toDate
    }
  };

  const expenseWhere: Prisma.ExpenseWhereInput = {
    incurredOn: {
      gte: fromDate,
      lte: toDate
    }
  };

  const [orders, orderItems, expenseGroups, costItems] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _sum: {
        subtotal: true,
        discount: true,
        tax: true,
        total: true
      }
    }),
    prisma.orderItem.aggregate({
      where: {
        order: orderWhere
      },
      _sum: {
        lineTotal: true
      }
    }),
    prisma.expense.groupBy({
      by: ["type"],
      where: expenseWhere,
      _sum: {
        amount: true
      }
    }),
    prisma.orderItem.findMany({
      where: {
        order: orderWhere
      },
      select: {
        qty: true,
        unitCost: true
      }
    })
  ]);

  const expenseMap: Record<ExpenseType, number> = {
    INGREDIENT: 0,
    STAFF: 0,
    ELECTRICITY: 0,
    OTHER: 0
  };

  for (const group of expenseGroups) {
    expenseMap[group.type] = toNumber(group._sum.amount);
  }

  const sales = toNumber(orders._sum.total);
  const subtotal = toNumber(orders._sum.subtotal);
  const discount = toNumber(orders._sum.discount);
  const tax = toNumber(orders._sum.tax);

  const staffCost = expenseMap.STAFF;
  const electricityCost = expenseMap.ELECTRICITY;
  const ingredientExpense = expenseMap.INGREDIENT;
  const otherExpense = expenseMap.OTHER;
  const cogsEstimate = costItems.reduce((sum, item) => sum + toNumber(item.unitCost) * item.qty, 0);

  const totalExpense = cogsEstimate + ingredientExpense + staffCost + electricityCost + otherExpense;
  const netProfit = sales - totalExpense;

  return {
    range: { from: fromDate, to: toDate },
    sales,
    subtotal,
    discount,
    tax,
    orderItemRevenue: toNumber(orderItems._sum.lineTotal),
    cost: {
      ingredientFromMenu: cogsEstimate,
      ingredientExpense,
      staff: staffCost,
      electricity: electricityCost,
      other: otherExpense,
      totalExpense
    },
    netProfit
  };
}

export async function calculateProfitTrends(from?: string | null, to?: string | null) {
  const range = asDateRange(from, to);
  const endDay = startOfDay(range.toDate);
  let startDay = startOfDay(range.fromDate);

  const daysDiff = Math.floor((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
  if (daysDiff + 1 > MAX_DAILY_POINTS) {
    startDay = addDays(endDay, -(MAX_DAILY_POINTS - 1));
  }

  const [orders, orderCosts, expenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "PAID",
        createdAt: {
          gte: startDay,
          lte: range.toDate
        }
      },
      select: {
        id: true,
        createdAt: true,
        total: true
      }
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: "PAID",
          createdAt: {
            gte: startDay,
            lte: range.toDate
          }
        }
      },
      select: {
        qty: true,
        unitCost: true,
        order: {
          select: {
            id: true,
            createdAt: true
          }
        }
      }
    }),
    prisma.expense.findMany({
      where: {
        incurredOn: {
          gte: startDay,
          lte: range.toDate
        }
      },
      select: {
        amount: true,
        incurredOn: true
      }
    })
  ]);

  const dayMap = new Map<string, { sales: number; expense: number }>();
  for (let cursor = startDay; cursor <= endDay; cursor = addDays(cursor, 1)) {
    dayMap.set(formatDayKey(cursor), { sales: 0, expense: 0 });
  }

  for (const order of orders) {
    const key = formatDayKey(order.createdAt);
    const point = dayMap.get(key);
    if (point) {
      point.sales += toNumber(order.total);
    }
  }

  for (const item of orderCosts) {
    const key = formatDayKey(item.order.createdAt);
    const point = dayMap.get(key);
    if (point) {
      point.expense += toNumber(item.unitCost) * item.qty;
    }
  }

  for (const expense of expenses) {
    const key = formatDayKey(expense.incurredOn);
    const point = dayMap.get(key);
    if (point) {
      point.expense += toNumber(expense.amount);
    }
  }

  const daily: ProfitPoint[] = Array.from(dayMap.entries()).map(([label, value]) => ({
    label,
    sales: value.sales,
    expense: value.expense,
    netProfit: value.sales - value.expense
  }));

  const weeklyMap = new Map<string, { sales: number; expense: number }>();
  for (const point of daily) {
    const baseDate = new Date(`${point.label}T00:00:00`);
    const weekKey = formatDayKey(startOfWeek(baseDate));
    const week = weeklyMap.get(weekKey) ?? { sales: 0, expense: 0 };
    week.sales += point.sales;
    week.expense += point.expense;
    weeklyMap.set(weekKey, week);
  }

  const weekly: ProfitPoint[] = Array.from(weeklyMap.entries()).map(([label, value]) => ({
    label,
    sales: value.sales,
    expense: value.expense,
    netProfit: value.sales - value.expense
  }));

  return { daily, weekly };
}
