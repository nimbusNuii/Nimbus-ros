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

  return (
    <div>
      <h1 className="page-title">หน้าสรุป</h1>
      <p className="page-subtitle">สรุปยอดขาย ต้นทุน ค่าของ ค่าพนักงาน ค่าไฟ และกำไรสุทธิ</p>

      <form className="card mb-4">
        <div className="grid grid-3 items-end gap-3">
          <div className="field">
            <label htmlFor="from">ตั้งแต่</label>
            <input id="from" name="from" type="date" defaultValue={fromValue} />
          </div>
          <div className="field">
            <label htmlFor="to">ถึง</label>
            <input id="to" name="to" type="date" defaultValue={toValue} />
          </div>
          <button type="submit">อัปเดตช่วงเวลา</button>
        </div>
      </form>

      <section className="grid grid-3 mb-4">
        <article className="card">
          <div className="pill">ยอดขายรวม</div>
          <h2 className="mb-0 mt-2 text-3xl font-bold">{formatCurrency(summary.sales, currency)}</h2>
        </article>
        <article className="card">
          <div className="pill">ค่าใช้จ่ายรวม</div>
          <h2 className="mb-0 mt-2 text-3xl font-bold">{formatCurrency(summary.cost.totalExpense, currency)}</h2>
        </article>
        <article className="card">
          <div className="pill">กำไรสุทธิ</div>
          <h2 className={`mb-0 mt-2 text-3xl font-bold ${summary.netProfit < 0 ? "text-red-600" : "text-[var(--ok)]"}`}>
            {formatCurrency(summary.netProfit, currency)}
          </h2>
        </article>
      </section>

      <section className="grid grid-2 mb-4">
        <ProfitTrendChart title="กำไรรายวัน" points={trends.daily} currency={currency} />
        <ProfitTrendChart title="กำไรรายสัปดาห์" points={trends.weekly} currency={currency} />
      </section>

      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">รายละเอียดต้นทุน</h2>
        <table className="table">
          <tbody>
            <tr>
              <td>ต้นทุนวัตถุดิบจากเมนูที่ขาย</td>
              <td>{formatCurrency(summary.cost.ingredientFromMenu, currency)}</td>
            </tr>
            <tr>
              <td>ค่าของ (บันทึกเพิ่ม)</td>
              <td>{formatCurrency(summary.cost.ingredientExpense, currency)}</td>
            </tr>
            <tr>
              <td>ค่าพนักงาน</td>
              <td>{formatCurrency(summary.cost.staff, currency)}</td>
            </tr>
            <tr>
              <td>ค่าไฟ</td>
              <td>{formatCurrency(summary.cost.electricity, currency)}</td>
            </tr>
            <tr>
              <td>อื่นๆ</td>
              <td>{formatCurrency(summary.cost.other, currency)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mb-0 text-sm text-[var(--muted)]">
          ช่วงข้อมูล: {formatDateTime(summary.range.from)} - {formatDateTime(summary.range.to)}
        </p>
      </section>
    </div>
  );
}
