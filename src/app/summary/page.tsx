import { calculateProfitTrends, calculateSummary } from "@/lib/summary";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { ProfitTrendChart } from "@/components/profit-trend-chart";

export const dynamic = "force-dynamic";

export default async function SummaryPage({
  searchParams
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
    prisma.storeSetting.findUnique({ where: { id: 1 } })
  ]);

  const currency = setting?.currency || "THB";
  const isZero = (value: number) => Math.abs(value) < 0.000001;
  const neutralAmountTone = "text-[var(--text)]";
  const profitTone = (value: number) => {
    if (isZero(value)) return neutralAmountTone;
    return value < 0 ? "text-red-600" : "text-[var(--ok)]";
  };
  const expenseTone = (value: number) => (isZero(value) ? neutralAmountTone : "text-red-600");

  return (
    <div>
      <form className="card mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,1fr))_auto] lg:items-end">
          <div className="field mb-0">
            <label htmlFor="from">ตั้งแต่</label>
            <input id="from" name="from" type="date" defaultValue={fromValue} />
          </div>
          <div className="field mb-0">
            <label htmlFor="to">ถึง</label>
            <input id="to" name="to" type="date" defaultValue={toValue} />
          </div>
          <button type="submit" className="w-full lg:w-auto">
            อัปเดตช่วงเวลา
          </button>
        </div>
      </form>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card">
          <div className="pill">ยอดขายรวม</div>
          <h2 className={`mb-0 mt-2 text-3xl font-bold ${neutralAmountTone}`}>{formatCurrency(summary.sales, currency)}</h2>
        </article>
        <article className="card">
          <div className="pill">ค่าใช้จ่ายรวม</div>
          <h2 className={`mb-0 mt-2 text-3xl font-bold ${expenseTone(summary.cost.totalExpense)}`}>
            {formatCurrency(summary.cost.totalExpense, currency)}
          </h2>
        </article>
        <article className="card">
          <div className="pill">กำไรขั้นต้น</div>
          <h2 className={`mb-0 mt-2 text-3xl font-bold ${profitTone(summary.profit.grossProfit)}`}>
            {formatCurrency(summary.profit.grossProfit, currency)}
          </h2>
        </article>
        <article className="card">
          <div className="pill">กำไรสุทธิ</div>
          <h2 className={`mb-0 mt-2 text-3xl font-bold ${profitTone(summary.netProfit)}`}>
            {formatCurrency(summary.profit.netProfit, currency)}
          </h2>
        </article>
      </section>

      <section className="card mb-4">
        <h2 className="mt-0 text-xl font-semibold">รายละเอียดกำไร</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
            <p className="m-0 text-sm text-[var(--muted)]">จำนวนบิลที่ชำระแล้ว</p>
            <p className="m-0 mt-1 text-lg font-semibold">{summary.paidOrderCount} บิล</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
            <p className="m-0 text-sm text-[var(--muted)]">กำไรเฉลี่ยต่อบิล</p>
            <p className={`m-0 mt-1 text-lg font-semibold ${profitTone(summary.profit.averageProfitPerBill)}`}>
              {formatCurrency(summary.profit.averageProfitPerBill, currency)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
            <p className="m-0 text-sm text-[var(--muted)]">ค่าใช้จ่ายดำเนินงาน</p>
            <p className={`m-0 mt-1 text-lg font-semibold ${expenseTone(summary.cost.operatingExpense)}`}>
              {formatCurrency(summary.cost.operatingExpense, currency)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
            <p className="m-0 text-sm text-[var(--muted)]">Net Margin</p>
            <p className={`m-0 mt-1 text-lg font-semibold ${profitTone(summary.profit.netMarginPercent)}`}>
              {summary.profit.netMarginPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">ยอดขายรวม</span>
            <span className={`font-semibold ${neutralAmountTone}`}>{formatCurrency(summary.sales, currency)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">ต้นทุนวัตถุดิบจากเมนู</span>
            <span className={`font-semibold ${expenseTone(summary.cost.ingredientFromMenu)}`}>
              {formatCurrency(summary.cost.ingredientFromMenu, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">กำไรขั้นต้น</span>
            <span className={`font-semibold ${profitTone(summary.profit.grossProfit)}`}>
              {formatCurrency(summary.profit.grossProfit, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">ค่าใช้จ่ายรวมทั้งหมด</span>
            <span className={`font-semibold ${expenseTone(summary.cost.totalExpense)}`}>
              {formatCurrency(summary.cost.totalExpense, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">กำไรสุทธิ</span>
            <span className={`font-semibold ${profitTone(summary.profit.netProfit)}`}>
              {formatCurrency(summary.profit.netProfit, currency)}
            </span>
          </div>
        </div>
      </section>

      <section className="mb-4 grid gap-3 xl:grid-cols-2">
        <ProfitTrendChart title="กำไรรายวัน" points={trends.daily} currency={currency} />
        <ProfitTrendChart title="กำไรรายสัปดาห์" points={trends.weekly} currency={currency} />
      </section>

      <section className="card mb-4">
        <h2 className="mt-0 text-xl font-semibold">รายละเอียดต้นทุน</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span>ต้นทุนวัตถุดิบจากเมนูที่ขาย</span>
            <span className={`font-semibold ${expenseTone(summary.cost.ingredientFromMenu)}`}>
              {formatCurrency(summary.cost.ingredientFromMenu, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span>ค่าของ (บันทึกเพิ่ม)</span>
            <span className={`font-semibold ${expenseTone(summary.cost.ingredientExpense)}`}>
              {formatCurrency(summary.cost.ingredientExpense, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span>ค่าพนักงาน</span>
            <span className={`font-semibold ${expenseTone(summary.cost.staff)}`}>{formatCurrency(summary.cost.staff, currency)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span>ค่าไฟ</span>
            <span className={`font-semibold ${expenseTone(summary.cost.electricity)}`}>
              {formatCurrency(summary.cost.electricity, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <span>อื่นๆ</span>
            <span className={`font-semibold ${expenseTone(summary.cost.other)}`}>{formatCurrency(summary.cost.other, currency)}</span>
          </div>
        </div>

        <p className="mb-0 text-sm text-[var(--muted)]">
          ช่วงข้อมูล: {formatDateTime(summary.range.from)} - {formatDateTime(summary.range.to)}
        </p>
      </section>

      <section className="card mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-semibold">ยอดขายตามสินค้าในช่วงที่เลือก</h2>
          <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
            รวม {summary.soldItemTotals.qty} ชิ้น /{" "}
            <span className={`font-semibold ${neutralAmountTone}`}>
              {formatCurrency(summary.soldItemTotals.revenue, currency)}
            </span>{" "}
            / กำไรรวม{" "}
            <span className={profitTone(summary.soldItemTotals.totalProfit)}>
              {formatCurrency(summary.soldItemTotals.totalProfit, currency)}
            </span>
          </span>
        </div>

        <div className="space-y-2 md:hidden">
          {summary.soldItems.map((item) => (
            <article key={item.name} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
              <p className="m-0 text-sm font-semibold">{item.name}</p>
              <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                <p className="m-0 text-[var(--muted)]">จำนวนขาย</p>
                <p className="m-0 text-right font-medium">{item.qty}</p>
                <p className="m-0 text-[var(--muted)]">ยอดขายรวม</p>
                <p className={`m-0 text-right font-semibold ${neutralAmountTone}`}>{formatCurrency(item.revenue, currency)}</p>
                <p className="m-0 text-[var(--muted)]">ราคาเฉลี่ย/ชิ้น</p>
                <p className="m-0 text-right font-medium">{formatCurrency(item.averagePrice, currency)}</p>
                <p className="m-0 text-[var(--muted)]">กำไรเฉลี่ย/ชิ้น</p>
                <p className={`m-0 text-right font-semibold ${profitTone(item.averageProfit)}`}>
                  {formatCurrency(item.averageProfit, currency)}
                </p>
                <p className="m-0 text-[var(--muted)]">กำไรรวม</p>
                <p className={`m-0 text-right font-semibold ${profitTone(item.totalProfit)}`}>
                  {formatCurrency(item.totalProfit, currency)}
                </p>
              </div>
            </article>
          ))}
          {summary.soldItems.length === 0 ? (
            <p className="py-6 text-center text-[var(--muted)]">ไม่พบข้อมูลการขายในช่วงวันที่นี้</p>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="table min-w-[980px]">
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>จำนวนที่ขาย</th>
                <th>ยอดขายรวม</th>
                <th>ราคาเฉลี่ย/ชิ้น</th>
                <th>กำไรเฉลี่ย/ชิ้น</th>
                <th>กำไรรวม</th>
              </tr>
            </thead>
            <tbody>
              {summary.soldItems.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.qty}</td>
                  <td className={`font-semibold ${neutralAmountTone}`}>{formatCurrency(item.revenue, currency)}</td>
                  <td>{formatCurrency(item.averagePrice, currency)}</td>
                  <td className={profitTone(item.averageProfit)}>{formatCurrency(item.averageProfit, currency)}</td>
                  <td className={`font-semibold ${profitTone(item.totalProfit)}`}>{formatCurrency(item.totalProfit, currency)}</td>
                </tr>
              ))}
              {summary.soldItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--muted)]">
                    ไม่พบข้อมูลการขายในช่วงวันที่นี้
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
