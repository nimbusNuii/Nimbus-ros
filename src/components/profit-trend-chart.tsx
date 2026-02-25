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
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>กำไรรวมช่วงนี้ {formatCurrency(totalNet, currency)}</p>
      <div style={{ display: "flex", alignItems: "end", gap: 5, minHeight: 190, overflowX: "auto", paddingBottom: 8 }}>
        {points.map((point) => {
          const height = Math.max(4, Math.round((Math.abs(point.netProfit) / maxAbs) * 130));
          const positive = point.netProfit >= 0;

          return (
            <div key={point.label} style={{ minWidth: 28, textAlign: "center" }}>
              <div
                title={`${point.label} : ${formatCurrency(point.netProfit, currency)}`}
                style={{
                  height,
                  borderRadius: 6,
                  background: positive ? "linear-gradient(180deg, #1f6f3f 0%, #2b9a56 100%)" : "linear-gradient(180deg, #9f1a1a 0%, #dc3a3a 100%)"
                }}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{shortLabel(point.label)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
