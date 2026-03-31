"use client";

import React, { FormEvent, useEffect, useState } from "react";
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

  const typeChip: Record<Expense["type"], { bg: string; border: string; color: string }> = {
    INGREDIENT:  { bg: "#fff7ed", border: "#fdba74", color: "#c2410c" },
    STAFF:       { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8" },
    ELECTRICITY: { bg: "#fefce8", border: "#fde047", color: "#854d0e" },
    OTHER:       { bg: "#f5f5f4", border: "#d6d3d1", color: "#57534e" },
  };

  const FIELD: React.CSSProperties = {
    height: 36, borderRadius: 8, border: "1px solid var(--line)",
    fontSize: "0.875rem", padding: "0 10px", background: "#fff", color: "var(--text)",
    width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>ค่าใช้จ่าย</h1>
          <span style={{ height: 26, padding: "0 10px", borderRadius: 99, background: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", display: "inline-flex", alignItems: "center" }}>
            {totalItems} รายการ
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setError(""); setCreateModalOpen(true); }}
          style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "none" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          เพิ่มค่าใช้จ่าย
        </button>
      </div>

      {/* ── Filter bar ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
        style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Row 1: labeled fields */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ค้นหา</span>
            <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="ค้นหาหมายเหตุ..." style={FIELD} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 130px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ประเภท</span>
            <select value={typeInput} onChange={(e) => setTypeInput(e.target.value as ExpenseTypeFilter)} style={FIELD}>
              <option value="ALL">ทุกประเภท</option>
              <option value="INGREDIENT">ค่าของ</option>
              <option value="STAFF">ค่าพนักงาน</option>
              <option value="ELECTRICITY">ค่าไฟ</option>
              <option value="OTHER">อื่นๆ</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 230px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ช่วงวันที่</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} style={FIELD} />
              <span style={{ color: "var(--muted)", fontSize: "0.8rem", flexShrink: 0 }}>–</span>
              <input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} style={FIELD} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>เรียงลำดับ</span>
            <select value={sortInput} onChange={(e) => setSortInput(e.target.value as ExpenseSort)} style={FIELD}>
              <option value="incurred_desc">วันที่ล่าสุดก่อน</option>
              <option value="incurred_asc">วันที่เก่าสุดก่อน</option>
              <option value="amount_desc">ยอดมากไปน้อย</option>
              <option value="amount_asc">ยอดน้อยไปมาก</option>
              <option value="created_desc">เพิ่มล่าสุดก่อน</option>
              <option value="created_asc">เพิ่มเก่าสุดก่อน</option>
            </select>
          </div>
        </div>

        {/* Row 2: actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 2, borderTop: "1px solid var(--line)" }}>
          <button type="submit" style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="#fff" strokeWidth="2.2" />
              <path d="M21 21l-4.35-4.35" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            ค้นหา
          </button>
          <button type="button" onClick={resetFilters} style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer", boxShadow: "none" }}>
            ล้าง
          </button>
        </div>
      </form>

      {/* ── Mobile cards ── */}
      <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
        {expenses.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: "0.875rem" }}>ยังไม่มีข้อมูล</p>
        ) : expenses.map((expense) => {
          const chip = typeChip[expense.type];
          return (
            <article key={expense.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
              {/* Top zone */}
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ padding: "3px 10px", borderRadius: 99, border: `1px solid ${chip.border}`, background: chip.bg, color: chip.color, fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {typeLabel[expense.type]}
                </span>
                <p style={{ margin: 0, flex: 1, fontSize: "0.875rem", color: "var(--muted)" }}>{formatDateTime(expense.incurredOn)}</p>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(expense.amount, currency)}</p>
              </div>
              {/* Bottom zone */}
              {expense.note && (
                <div style={{ padding: "8px 14px 12px", borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>{expense.note}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden lg:block" style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
                {["ประเภท", "วันที่", "จำนวน", "หมายเหตุ"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "40px 14px", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>ยังไม่มีข้อมูล</td>
                </tr>
              ) : expenses.map((expense, idx) => {
                const chip = typeChip[expense.type];
                return (
                  <tr key={expense.id} style={{ borderTop: idx > 0 ? "1px solid var(--line)" : undefined, transition: "background 100ms" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 99, border: `1px solid ${chip.border}`, background: chip.bg, color: chip.color, fontSize: "0.75rem", fontWeight: 700 }}>
                        {typeLabel[expense.type]}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: "0.875rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDateTime(expense.incurredOn)}</td>
                    <td style={{ padding: "11px 14px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatCurrency(expense.amount, currency)}</td>
                    <td style={{ padding: "11px 14px", fontSize: "0.875rem", color: "var(--muted)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{expense.note || "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationControls page={currentPage} pageSize={pageSize} totalItems={totalItems} onPageChange={goPage} />
      {error && <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626" }}>{error}</p>}

      {/* ── Create modal ── */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateModalOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}
          className="sm:items-center sm:p-4"
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "90dvh", overflowY: "auto", display: "flex", flexDirection: "column" }} className="sm:rounded-2xl">
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>เพิ่มค่าใช้จ่าย</h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>บันทึกค่าใช้จ่ายรายวันเพื่อใช้สรุปกำไร</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                aria-label="ปิด"
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "none", padding: 0, color: "var(--muted)", flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#1a1614" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={onSubmit} style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="exp-type" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>ประเภท <span style={{ color: "var(--brand)" }}>*</span></label>
                <select id="exp-type" name="type" required defaultValue="INGREDIENT" style={{ ...FIELD }}>
                  <option value="INGREDIENT">ค่าของ</option>
                  <option value="STAFF">ค่าพนักงาน</option>
                  <option value="ELECTRICITY">ค่าไฟ</option>
                  <option value="OTHER">อื่นๆ</option>
                </select>
              </div>

              {/* Amount + Date row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="exp-amount" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>จำนวนเงิน <span style={{ color: "var(--brand)" }}>*</span></label>
                  <input id="exp-amount" name="amount" type="number" min={0} step="0.01" required style={{ ...FIELD }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="exp-date" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>วันที่ <span style={{ color: "var(--brand)" }}>*</span></label>
                  <input id="exp-date" name="incurredOn" type="date" required style={{ ...FIELD }} />
                </div>
              </div>

              {/* Note */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="exp-note" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>หมายเหตุ</label>
                <textarea id="exp-note" name="note" rows={3} placeholder="รายละเอียดเพิ่มเติม..." style={{ borderRadius: 8, border: "1px solid var(--line)", fontSize: "0.875rem", padding: "8px 10px", background: "#fff", color: "var(--text)", resize: "vertical", minHeight: 72 }} />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
                <button type="button" onClick={() => setCreateModalOpen(false)} style={{ height: 38, padding: "0 16px", borderRadius: 9, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", boxShadow: "none" }}>
                  ยกเลิก
                </button>
                <button type="submit" disabled={saving} style={{ height: 38, padding: "0 18px", borderRadius: 9, border: "none", background: saving ? "var(--line)" : "var(--brand)", color: saving ? "var(--muted)" : "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: "none" }}>
                  {saving ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}
                </button>
              </div>

              {error && <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626" }}>{error}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
