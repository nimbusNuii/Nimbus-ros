import { formatCurrency } from "@/lib/format";

type TrendPoint = {
  label: string;
  sales: number;
  expense: number;
  netProfit: number;
};

type ProfitTrendChartProps = {
  title: string;
  points: TrendPoint[];
  currency: string;
};

function shortLabel(label: string) {
  return label.slice(5);
}

export function ProfitTrendChart({ title, points, currency }: ProfitTrendChartProps) {
  const maxAbs =
    points.reduce((max, point) => {
      const abs = Math.abs(point.netProfit);
      return abs > max ? abs : max;
    }, 0) || 1;

  const totalNet = points.reduce((sum, point) => sum + point.netProfit, 0);

  return (
    <section className="card">
      <h2 className="mt-0 text-xl font-semibold">{title}</h2>
      <p className="mt-0 text-sm text-[var(--muted)]">กำไรรวมช่วงนี้ {formatCurrency(totalNet, currency)}</p>
      <div className="flex min-h-[190px] items-end gap-2 overflow-x-auto pb-2">
        {points.map((point) => {
          const height = Math.max(4, Math.round((Math.abs(point.netProfit) / maxAbs) * 130));
          const positive = point.netProfit >= 0;

          return (
            <div key={point.label} className="min-w-8 text-center">
              <div
                title={`${point.label} : ${formatCurrency(point.netProfit, currency)}`}
                style={{
                  height,
                  borderRadius: 8,
                  background: positive ? "#16a34a" : "#dc2626"
                }}
                className="transition-all duration-200 ease-in-out"
              />
              <div className="mt-1 text-[11px] text-[var(--muted)]">{shortLabel(point.label)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
