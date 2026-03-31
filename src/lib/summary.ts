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

  const [orders, expenseGroups, soldItemRows, paymentGroups] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _count: {
        _all: true
      },
      _sum: {
        subtotal: true,
        discount: true,
        tax: true,
        total: true
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
        nameSnapshot: true,
        qty: true,
        lineTotal: true,
        unitCost: true
      }
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: orderWhere,
      _sum: { total: true },
      _count: { _all: true }
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
  const paidOrderCount = orders._count._all;

  const staffCost = expenseMap.STAFF;
  const electricityCost = expenseMap.ELECTRICITY;
  const ingredientExpense = expenseMap.INGREDIENT;
  const otherExpense = expenseMap.OTHER;
  const soldMap = new Map<
    string,
    {
      qty: number;
      revenue: number;
      cost: number;
    }
  >();
  let cogsEstimate = 0;

  for (const row of soldItemRows) {
    const unitCost = toNumber(row.unitCost);
    const revenue = toNumber(row.lineTotal);
    const cost = unitCost * row.qty;
    cogsEstimate += cost;

    const current = soldMap.get(row.nameSnapshot) ?? {
      qty: 0,
      revenue: 0,
      cost: 0
    };
    current.qty += row.qty;
    current.revenue += revenue;
    current.cost += cost;
    soldMap.set(row.nameSnapshot, current);
  }

  const totalExpense = cogsEstimate + ingredientExpense + staffCost + electricityCost + otherExpense;
  const grossProfit = sales - cogsEstimate;
  const netProfit = sales - totalExpense;
  const soldItems = Array.from(soldMap.entries())
    .map(([name, item]) => {
      const qty = item.qty;
      const revenue = item.revenue;
      const totalProfit = revenue - item.cost;
      return {
        name,
        qty,
        revenue,
        totalProfit,
        averagePrice: qty > 0 ? revenue / qty : 0,
        averageProfit: qty > 0 ? totalProfit / qty : 0
      };
    })
    .sort((a, b) => {
      return b.revenue - a.revenue;
    });
  const soldItemTotals = soldItems.reduce(
    (sum, item) => ({
      qty: sum.qty + item.qty,
      revenue: sum.revenue + item.revenue,
      totalProfit: sum.totalProfit + item.totalProfit
    }),
    { qty: 0, revenue: 0, totalProfit: 0 }
  );
  const soldItemAverageProfit = soldItemTotals.qty > 0 ? soldItemTotals.totalProfit / soldItemTotals.qty : 0;
  const operatingExpense = ingredientExpense + staffCost + electricityCost + otherExpense;
  const averageProfitPerBill = paidOrderCount > 0 ? netProfit / paidOrderCount : 0;
  const netMarginPercent = sales > 0 ? (netProfit / sales) * 100 : 0;

  const paymentBreakdown: Array<{ method: string; total: number; count: number }> = paymentGroups.map((g) => ({
    method: g.paymentMethod,
    total: toNumber(g._sum.total),
    count: g._count._all,
  })).sort((a, b) => b.total - a.total);

  return {
    range: { from: fromDate, to: toDate },
    sales,
    subtotal,
    discount,
    tax,
    orderItemRevenue: soldItemTotals.revenue,
    paidOrderCount,
    cost: {
      ingredientFromMenu: cogsEstimate,
      ingredientExpense,
      staff: staffCost,
      electricity: electricityCost,
      other: otherExpense,
      operatingExpense,
      totalExpense
    },
    profit: {
      grossProfit,
      netProfit,
      averageProfitPerBill,
      netMarginPercent
    },
    soldItems,
    soldItemTotals: {
      ...soldItemTotals,
      averageProfit: soldItemAverageProfit
    },
    paymentBreakdown,
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
