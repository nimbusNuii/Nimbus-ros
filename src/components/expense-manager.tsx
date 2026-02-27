"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PaginationControls } from "@/components/pagination-controls";

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
  currentPage: number;
  pageSize: number;
  totalItems: number;
  initialQuery: string;
  initialSort: ExpenseSort;
  initialType: ExpenseTypeFilter;
  initialFrom: string;
  initialTo: string;
};

type ExpenseSort = "incurred_desc" | "incurred_asc" | "amount_desc" | "amount_asc" | "created_desc" | "created_asc";
type ExpenseTypeFilter = "ALL" | "INGREDIENT" | "STAFF" | "ELECTRICITY" | "OTHER";

const typeLabel: Record<Expense["type"], string> = {
  INGREDIENT: "ค่าของ",
  STAFF: "ค่าพนักงาน",
  ELECTRICITY: "ค่าไฟ",
  OTHER: "อื่นๆ"
};

export function ExpenseManager({
  initialExpenses,
  currency,
  currentPage,
  pageSize,
  totalItems,
  initialQuery,
  initialSort,
  initialType,
  initialFrom,
  initialTo
}: ExpenseManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [saving, setSaving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [sortInput, setSortInput] = useState<ExpenseSort>(initialSort);
  const [typeInput, setTypeInput] = useState<ExpenseTypeFilter>(initialType);
  const [fromInput, setFromInput] = useState(initialFrom);
  const [toInput, setToInput] = useState(initialTo);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  useEffect(() => {
    setQueryInput(initialQuery);
    setSortInput(initialSort);
    setTypeInput(initialType);
    setFromInput(initialFrom);
    setToInput(initialTo);
  }, [initialFrom, initialQuery, initialSort, initialTo, initialType]);

  function goPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    const safePage = Math.max(1, Math.trunc(nextPage));
    if (safePage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(safePage));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    const q = queryInput.trim();
    if (q) params.set("q", q);
    else params.delete("q");
    if (typeInput === "ALL") params.delete("type");
    else params.set("type", typeInput);
    if (fromInput) params.set("from", fromInput);
    else params.delete("from");
    if (toInput) params.set("to", toInput);
    else params.delete("to");
    if (sortInput === "incurred_desc") params.delete("sort");
    else params.set("sort", sortInput);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    setQueryInput("");
    setSortInput("incurred_desc");
    setTypeInput("ALL");
    setFromInput("");
    setToInput("");
    router.push(pathname);
  }

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
      setCreateModalOpen(false);
      goPage(1);
      router.refresh();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-semibold">ประวัติค่าใช้จ่ายล่าสุด</h2>
          <button
            type="button"
            className="px-2 py-1.5 text-xs lg:px-3 lg:py-2 lg:text-sm"
            onClick={() => {
              setError("");
              setCreateModalOpen(true);
            }}
          >
            เพิ่มค่าใช้จ่าย
          </button>
        </div>
        <form
          className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="ค้นหาหมายเหตุ" />
          <select value={typeInput} onChange={(event) => setTypeInput(event.target.value as ExpenseTypeFilter)}>
            <option value="ALL">ทุกประเภท</option>
            <option value="INGREDIENT">ค่าของ</option>
            <option value="STAFF">ค่าพนักงาน</option>
            <option value="ELECTRICITY">ค่าไฟ</option>
            <option value="OTHER">อื่นๆ</option>
          </select>
          <input type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} />
          <input type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} />
          <select value={sortInput} onChange={(event) => setSortInput(event.target.value as ExpenseSort)}>
            <option value="incurred_desc">วันที่ล่าสุดก่อน</option>
            <option value="incurred_asc">วันที่เก่าสุดก่อน</option>
            <option value="amount_desc">ยอดมากไปน้อย</option>
            <option value="amount_asc">ยอดน้อยไปมาก</option>
            <option value="created_desc">เพิ่มล่าสุดก่อน</option>
            <option value="created_asc">เพิ่มเก่าสุดก่อน</option>
          </select>
          <button type="submit" className="px-2 py-1.5 text-xs lg:px-3 lg:py-2 lg:text-sm">
            ค้นหา
          </button>
          <button type="button" className="secondary px-2 py-1.5 text-xs lg:px-3 lg:py-2 lg:text-sm" onClick={resetFilters}>
            ล้างตัวกรอง
          </button>
        </form>

        <div className="space-y-2 md:hidden">
          {expenses.map((expense) => (
            <article key={expense.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="m-0 text-sm font-semibold">{typeLabel[expense.type]}</p>
                <p className="m-0 text-sm font-semibold">{formatCurrency(expense.amount, currency)}</p>
              </div>
              <p className="m-0 mt-1 text-xs text-[var(--muted)]">{formatDateTime(expense.incurredOn)}</p>
              <p className="m-0 mt-2 text-sm text-[var(--text)]">{expense.note || "-"}</p>
            </article>
          ))}
          {expenses.length === 0 ? <p className="py-6 text-center text-[var(--muted)]">ยังไม่มีข้อมูล</p> : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="table min-w-[560px]">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>วันที่</th>
                <th>จำนวน</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{typeLabel[expense.type]}</td>
                  <td>{formatDateTime(expense.incurredOn)}</td>
                  <td className="font-semibold">{formatCurrency(expense.amount, currency)}</td>
                  <td>{expense.note || "-"}</td>
                </tr>
              ))}
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-[var(--muted)]">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goPage}
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      {createModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCreateModalOpen(false);
          }}
        >
          <div className="modal-panel" style={{ width: "min(520px, 100%)" }}>
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">เพิ่มค่าใช้จ่าย</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">บันทึกค่าใช้จ่ายรายวันเพื่อใช้สรุปกำไร</p>
              </div>
              <button
                type="button"
                className="secondary px-2 py-1.5 text-xs lg:px-3 lg:py-2 lg:text-sm"
                onClick={() => setCreateModalOpen(false)}
              >
                ปิด
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-2">
              <div className="field mb-0">
                <label htmlFor="type">ประเภท *</label>
                <select id="type" name="type" required>
                  <option value="INGREDIENT">ค่าของ</option>
                  <option value="STAFF">ค่าพนักงาน</option>
                  <option value="ELECTRICITY">ค่าไฟ</option>
                  <option value="OTHER">อื่นๆ</option>
                </select>
              </div>
              <div className="field mb-0">
                <label htmlFor="amount">จำนวนเงิน *</label>
                <input id="amount" name="amount" type="number" min={0} step="0.01" required />
              </div>
              <div className="field mb-0">
                <label htmlFor="incurredOn">วันที่ *</label>
                <input id="incurredOn" name="incurredOn" type="date" required />
              </div>
              <div className="field mb-0">
                <label htmlFor="note">หมายเหตุ</label>
                <textarea id="note" name="note" rows={3} />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="secondary px-2 py-1.5 text-xs lg:px-3 lg:py-2 lg:text-sm"
                  onClick={() => setCreateModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button className="px-2 py-1.5 text-xs lg:px-3 lg:py-2 lg:text-sm" disabled={saving}>
                  {saving ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
