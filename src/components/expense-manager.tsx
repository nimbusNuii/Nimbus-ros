"use client";

import { FormEvent, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";

type Expense = {
  id: string;
  type: "INGREDIENT" | "STAFF" | "ELECTRICITY" | "OTHER";
  amount: number;
  note: string | null;
  incurredOn: string;
};

type ExpenseManagerProps = {
  initialExpenses: Expense[];
  currency: string;
};

const typeLabel: Record<Expense["type"], string> = {
  INGREDIENT: "ค่าของ",
  STAFF: "ค่าพนักงาน",
  ELECTRICITY: "ค่าไฟ",
  OTHER: "อื่นๆ"
};

export function ExpenseManager({ initialExpenses, currency }: ExpenseManagerProps) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          type: form.get("type"),
          amount: Number(form.get("amount")),
          incurredOn: form.get("incurredOn"),
          note: form.get("note")
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Cannot save expense");
      }

      setExpenses((prev) => [data, ...prev]);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">เพิ่มค่าใช้จ่าย</h2>
        <form onSubmit={onSubmit} className="space-y-2">
          <div className="field">
            <label htmlFor="type">ประเภท *</label>
            <select id="type" name="type" required>
              <option value="INGREDIENT">ค่าของ</option>
              <option value="STAFF">ค่าพนักงาน</option>
              <option value="ELECTRICITY">ค่าไฟ</option>
              <option value="OTHER">อื่นๆ</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">จำนวนเงิน *</label>
            <input id="amount" name="amount" type="number" min={0} step="0.01" required />
          </div>
          <div className="field">
            <label htmlFor="incurredOn">วันที่ *</label>
            <input id="incurredOn" name="incurredOn" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="note">หมายเหตุ</label>
            <textarea id="note" name="note" rows={3} />
          </div>

          <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}</button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">ประวัติค่าใช้จ่ายล่าสุด</h2>
        <div className="overflow-x-auto">
          <table className="table min-w-[560px]">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>วันที่</th>
                <th>จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{typeLabel[expense.type]}</td>
                  <td>{formatDateTime(expense.incurredOn)}</td>
                  <td className="font-semibold">{formatCurrency(expense.amount, currency)}</td>
                </tr>
              ))}
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-[var(--muted)]">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
