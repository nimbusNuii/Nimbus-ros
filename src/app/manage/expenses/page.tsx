import { ExpenseManager } from "@/components/expense-manager";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManageExpensesPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const [expenses, settings] = await Promise.all([
    prisma.expense.findMany({ orderBy: { incurredOn: "desc" }, take: 100 }),
    prisma.storeSetting.findUnique({ where: { id: 1 } })
  ]);

  return (
    <div>
      <ExpenseManager
        initialExpenses={expenses.map((expense) => ({
          ...expense,
          amount: toNumber(expense.amount),
          incurredOn: expense.incurredOn.toISOString()
        }))}
        currency={settings?.currency || "THB"}
      />
    </div>
  );
}
