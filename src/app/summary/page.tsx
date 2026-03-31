import { calculateProfitTrends, calculateSummary } from "@/lib/summary";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { ProfitTrendChart } from "@/components/profit-trend-chart";

export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "เงินสด", CARD: "บัตร", TRANSFER: "โอนเงิน", QR: "QR"
};
const PAYMENT_COLOR: Record<string, string> = {
  CASH: "#16a34a", CARD: "#2563eb", TRANSFER: "#7c3aed", QR: "#d97706"
};
const PAYMENT_BG: Record<string, string> = {
  CASH: "#f0fdf4", CARD: "#eff6ff", TRANSFER: "#f5f3ff", QR: "#fffbeb"
};
const PAYMENT_BORDER: Record<string, string> = {
  CASH: "#bbf7d0", CARD: "#bfdbfe", TRANSFER: "#ddd6fe", QR: "#fde68a"
};

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const params = await searchParams;
  const todayText = new Date().toISOString().slice(0, 10);
  const fromValue = params.from || todayText;
  const toValue = params.to || todayText;

  const [summary, trends, setting] = await Promise.all([
    calculateSummary(params.from, params.to),
    calculateProfitTrends(params.from, params.to),
    prisma.storeSetting.findUnique({ where: { id: 1 } }),
  ]);

  const currency = setting?.currency || "THB";
  const isZero = (v: number) => Math.abs(v) < 0.000001;
  const profitColor = (v: number) => isZero(v) ? "var(--text)" : v < 0 ? "#dc2626" : "#16a34a";
  const expenseColor = (v: number) => isZero(v) ? "var(--text)" : "#dc2626";

  const costItems = [
    { label: "ต้นทุนวัตถุดิบ (เมนู)", value: summary.cost.ingredientFromMenu },
    { label: "ค่าของ (บันทึกเพิ่ม)",  value: summary.cost.ingredientExpense },
    { label: "ค่าพนักงาน",            value: summary.cost.staff },
    { label: "ค่าไฟ",                 value: summary.cost.electricity },
    { label: "อื่นๆ",                 value: summary.cost.other },
  ];
  const maxCost = Math.max(...costItems.map((c) => c.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Date filter ── */}
      <form style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 16px", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
          <label htmlFor="from" style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ตั้งแต่</label>
          <input id="from" name="from" type="date" defaultValue={fromValue} style={{ height: 38, borderRadius: 9, border: "1px solid var(--line)", fontSize: "0.875rem", padding: "0 10px", background: "var(--bg)", color: "var(--text)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
          <label htmlFor="to" style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ถึง</label>
          <input id="to" name="to" type="date" defaultValue={toValue} style={{ height: 38, borderRadius: 9, border: "1px solid var(--line)", fontSize: "0.875rem", padding: "0 10px", background: "var(--bg)", color: "var(--text)" }} />
        </div>
        <button type="submit" style={{ height: 38, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          ดูรายงาน
        </button>
      </form>

      {/* ── 4 KPI cards ── */}
      <div style={{ display: "grid", gap: 12 }} className="sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "ยอดขายรวม",  value: summary.sales,               sub: `${summary.paidOrderCount} บิล`,                               color: "#1d6db5", leftBorder: "#1d6db5" },
          { label: "ค่าใช้จ่าย", value: summary.cost.totalExpense,   sub: `ดำเนินงาน ${formatCurrency(summary.cost.operatingExpense, currency)}`, color: expenseColor(summary.cost.totalExpense), leftBorder: "#dc2626" },
          { label: "กำไรขั้นต้น",value: summary.profit.grossProfit, sub: `เฉลี่ย/บิล ${formatCurrency(summary.profit.averageProfitPerBill, currency)}`, color: profitColor(summary.profit.grossProfit), leftBorder: profitColor(summary.profit.grossProfit) },
          { label: "กำไรสุทธิ",  value: summary.profit.netProfit,   sub: `Net Margin ${summary.profit.netMarginPercent.toFixed(1)}%`,     color: profitColor(summary.profit.netProfit), leftBorder: profitColor(summary.profit.netProfit) },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "#fff", border: "1px solid var(--line)", borderLeft: `4px solid ${kpi.leftBorder}`, borderRadius: 14, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{kpi.label}</p>
            <p style={{ margin: "0 0 4px", fontSize: "1.55rem", fontWeight: 800, color: kpi.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {formatCurrency(kpi.value, currency)}
            </p>
            <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── เงินเข้าแต่ละประเภท ── */}
      <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
        <p style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>เงินเข้าแต่ละประเภทชำระ</p>
        {summary.paymentBreakdown.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0 }}>ไม่มีข้อมูล</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10 }} className="sm:grid-cols-2 lg:grid-cols-4">
              {summary.paymentBreakdown.map((p) => {
                const pct = summary.sales > 0 ? (p.total / summary.sales) * 100 : 0;
                const color = PAYMENT_COLOR[p.method] ?? "#64748b";
                const bg = PAYMENT_BG[p.method] ?? "#f8fafc";
                const border = PAYMENT_BORDER[p.method] ?? "#e2e8f0";
                return (
                  <div key={p.method} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color }}>{PAYMENT_LABEL[p.method] ?? p.method}</span>
                      <span style={{ fontSize: "0.68rem", color, background: "#fff", border: `1px solid ${border}`, borderRadius: 20, padding: "1px 8px", fontWeight: 700 }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <p style={{ margin: "0 0 3px", fontSize: "1.25rem", fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(p.total, currency)}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{p.count} บิล</p>
                    {/* Bar */}
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(0,0,0,0.08)", marginTop: 10 }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: color, transition: "width 300ms ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Charts ── */}
      <div style={{ display: "grid", gap: 14 }} className="xl:grid-cols-2">
        <ProfitTrendChart title="กำไรรายวัน" points={trends.daily} currency={currency} />
        <ProfitTrendChart title="กำไรรายสัปดาห์" points={trends.weekly} currency={currency} />
      </div>

      {/* ── P&L + Cost (2-col) ── */}
      <div style={{ display: "grid", gap: 14 }} className="lg:grid-cols-2">

        {/* P&L waterfall */}
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>กำไร-ขาดทุน</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { label: "ยอดขายรวม",           value: summary.sales,                    color: "var(--brand)",  bold: false },
              { label: "หัก ต้นทุนวัตถุดิบ",   value: -summary.cost.ingredientFromMenu, color: "#dc2626",       bold: false },
              { label: "= กำไรขั้นต้น",        value: summary.profit.grossProfit,       color: profitColor(summary.profit.grossProfit), bold: true, divider: true },
              { label: "หัก ค่าใช้จ่ายดำเนินงาน", value: -summary.cost.operatingExpense, color: "#dc2626",    bold: false },
              { label: "= กำไรสุทธิ",          value: summary.profit.netProfit,         color: profitColor(summary.profit.netProfit),   bold: true, divider: true },
            ].map((row, i) => (
              <div key={i}>
                {row.divider && <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: row.bold ? "var(--bg)" : "transparent" }}>
                  <span style={{ fontSize: "0.8rem", color: row.bold ? "var(--text)" : "var(--muted)", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                  <span style={{ fontSize: row.bold ? "1rem" : "0.875rem", fontWeight: row.bold ? 800 : 600, color: row.color, fontVariantNumeric: "tabular-nums" }}>
                    {row.value < 0 ? `−${formatCurrency(Math.abs(row.value), currency)}` : formatCurrency(row.value, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cost breakdown */}
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>รายละเอียดต้นทุน</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {costItems.map((item) => {
              const pct = Math.round((item.value / maxCost) * 100);
              return (
                <div key={item.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{item.label}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: expenseColor(item.value), fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.value, currency)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--line)" }}>
                    {pct > 0 && <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: "#dc2626", opacity: 0.65 }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)" }}>รวม</span>
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "#dc2626", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(summary.cost.totalExpense, currency)}</span>
          </div>
        </section>
      </div>

      {/* ── Product sales table ── */}
      <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>ยอดขายแยกตามสินค้า</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{summary.soldItemTotals.qty} ชิ้น</span>
            <span style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", color: "var(--brand)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(summary.soldItemTotals.revenue, currency)}</span>
            <span style={{ background: summary.soldItemTotals.totalProfit < 0 ? "#fef2f2" : "#f0fdf4", border: `1px solid ${summary.soldItemTotals.totalProfit < 0 ? "#fca5a5" : "#bbf7d0"}`, borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", color: profitColor(summary.soldItemTotals.totalProfit), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>กำไร {formatCurrency(summary.soldItemTotals.totalProfit, currency)}</span>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {summary.soldItems.length === 0 && <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.875rem", padding: "24px 0" }}>ไม่พบข้อมูล</p>}
          {summary.soldItems.map((item, idx) => (
            <div key={item.name} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ minWidth: 24, height: 20, borderRadius: 5, background: idx < 3 ? "var(--brand)" : "var(--line)", color: idx < 3 ? "#fff" : "var(--muted)", fontSize: "0.65rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>#{idx + 1}</span>
                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", background: "#fff", border: "1px solid var(--line)", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>×{item.qty}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 0" }}>
                {[
                  { l: "ยอดขายรวม", v: formatCurrency(item.revenue, currency), c: "var(--text)" },
                  { l: "กำไรรวม",   v: formatCurrency(item.totalProfit, currency), c: profitColor(item.totalProfit) },
                ].map((cell) => (
                  <div key={cell.l} style={{ display: "contents" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{cell.l}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: cell.c, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cell.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "var(--bg)", borderBottom: "2px solid var(--line)" }}>
                {["#", "สินค้า", "จำนวน", "ยอดขายรวม", "กำไรเฉลี่ย/ชิ้น", "กำไรรวม"].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: ["#", "จำนวน"].includes(h) ? "center" : "left", fontWeight: 700, color: "var(--muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.soldItems.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "28px 0", color: "var(--muted)", fontSize: "0.875rem" }}>ไม่พบข้อมูลการขายในช่วงวันที่นี้</td></tr>
              )}
              {summary.soldItems.map((item, idx) => (
                <tr key={item.name} style={{ borderBottom: "1px solid var(--line)", background: idx % 2 === 1 ? "var(--bg)" : "#fff" }}>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 18, borderRadius: 4, background: idx < 3 ? "var(--brand)" : "var(--line)", color: idx < 3 ? "#fff" : "var(--muted)", fontSize: "0.65rem", fontWeight: 800 }}>{idx + 1}</span>
                  </td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "var(--text)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{item.qty}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 700, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.revenue, currency)}</td>
                  <td style={{ padding: "9px 12px", color: profitColor(item.averageProfit), fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.averageProfit, currency)}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 800, color: profitColor(item.totalProfit), fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.totalProfit, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
