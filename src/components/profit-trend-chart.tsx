"use client";

import { useState } from "react";
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
  const parts = label.split("-");
  return parts.length === 3 ? parts[2] : label.slice(-5);
}

/** Single-point: show as a clean summary card instead of a 1-bar chart */
function SinglePointCard({ point, currency }: { point: TrendPoint; currency: string }) {
  const positive = point.netProfit >= 0;
  const rows = [
    { label: "ยอดขาย",  value: point.sales,      color: "#1d6db5" },
    { label: "ต้นทุน",  value: point.expense,    color: "#dc2626" },
    { label: "กำไร",    value: point.netProfit,  color: positive ? "#16a34a" : "#dc2626" },
  ];
  return (
    <div style={{ padding: "6px 0 10px" }}>
      <p style={{ margin: "0 0 14px", fontSize: "0.75rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
        📅 {point.label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{r.label}</span>
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: r.color, fontVariantNumeric: "tabular-nums" }}>
              {r.value < 0 ? "−" : ""}{formatCurrency(Math.abs(r.value), currency)}
            </span>
          </div>
        ))}
      </div>
      {/* Profit bar */}
      <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: "var(--line)" }}>
        {point.sales > 0 && (
          <div style={{
            height: "100%", width: `${Math.min(100, Math.max(4, (Math.abs(point.netProfit) / point.sales) * 100)).toFixed(1)}%`,
            borderRadius: 3, background: positive ? "#16a34a" : "#dc2626",
          }} />
        )}
      </div>
      <p style={{ margin: "5px 0 0", fontSize: "0.68rem", color: "var(--muted)", textAlign: "right" }}>
        Net margin {point.sales > 0 ? ((point.netProfit / point.sales) * 100).toFixed(1) : "0.0"}%
      </p>
    </div>
  );
}

export function ProfitTrendChart({ title, points, currency }: ProfitTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const CHART_H = 140;
  const maxAbs = points.reduce((m, p) => Math.max(m, Math.abs(p.netProfit)), 0) || 1;
  const totalNet = points.reduce((s, p) => s + p.netProfit, 0);
  const isPositive = totalNet >= 0;

  /* bar width: cap at 48px for few items, min 24px */
  const barFlexBasis = points.length <= 5 ? "0 0 clamp(24px, 15%, 64px)" : "1 0 24px";

  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "20px 20px 16px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
            {points.length === 1 ? "วันเดียว" : `${points.length} จุดข้อมูล`}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: isPositive ? "#16a34a" : "#dc2626" }}>
          {totalNet < 0 ? "−" : ""}{formatCurrency(Math.abs(totalNet), currency)}
        </p>
      </div>

      {/* Empty */}
      {points.length === 0 && (
        <div style={{ height: CHART_H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.82rem" }}>
          ไม่มีข้อมูลในช่วงนี้
        </div>
      )}

      {/* Single point → card view */}
      {points.length === 1 && <SinglePointCard point={points[0]} currency={currency} />}

      {/* Multi point → bar chart */}
      {points.length > 1 && (
        <div style={{ position: "relative" }}>
          {/* Grid lines */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ width: "100%", height: 1, background: i === 3 ? "var(--line)" : "#f1f5f9" }} />
            ))}
          </div>

          {/* Bars */}
          <div style={{
            display: "flex", alignItems: "flex-end",
            gap: points.length <= 7 ? 8 : 4,
            height: CHART_H, overflowX: "auto", scrollbarWidth: "none",
            justifyContent: points.length <= 7 ? "center" : "flex-start",
            position: "relative",
          }}>
            {points.map((point, idx) => {
              const barH = Math.max(6, Math.round((Math.abs(point.netProfit) / maxAbs) * (CHART_H - 16)));
              const positive = point.netProfit >= 0;
              const isHov = hovered === idx;
              return (
                <div
                  key={point.label}
                  style={{ flex: barFlexBasis, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", position: "relative" }}
                  onMouseEnter={() => setHovered(idx)}
                  onMouseLeave={() => setHovered(null)}
                  onTouchStart={() => setHovered(idx)}
                  onTouchEnd={() => setTimeout(() => setHovered(null), 1200)}
                >
                  {/* Tooltip */}
                  {isHov && (
                    <div style={{
                      position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                      background: "#1a1614", color: "#fff", borderRadius: 8, padding: "7px 11px",
                      fontSize: "0.72rem", whiteSpace: "nowrap", zIndex: 10,
                      pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                    }}>
                      <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#e2e8f0" }}>{point.label}</p>
                      <p style={{ margin: "2px 0", color: positive ? "#4ade80" : "#f87171", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        กำไร {point.netProfit < 0 ? "−" : ""}{formatCurrency(Math.abs(point.netProfit), currency)}
                      </p>
                      <p style={{ margin: "2px 0", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                        ขาย {formatCurrency(point.sales, currency)}
                      </p>
                      <p style={{ margin: "2px 0", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                        ต้นทุน {formatCurrency(point.expense, currency)}
                      </p>
                      {/* Arrow */}
                      <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #1a1614" }} />
                    </div>
                  )}

                  {/* Bar */}
                  <div style={{
                    width: "100%", height: barH, borderRadius: "5px 5px 3px 3px",
                    background: positive ? (isHov ? "#15803d" : "#16a34a") : (isHov ? "#b91c1c" : "#dc2626"),
                    transition: "background 120ms ease",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "rgba(255,255,255,0.12)", borderRadius: "5px 5px 0 0" }} />
                  </div>

                  {/* X label */}
                  <span style={{ fontSize: "0.62rem", color: isHov ? "var(--text)" : "var(--muted)", fontWeight: isHov ? 700 : 400, transition: "color 120ms", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {shortLabel(point.label)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend — only for bar chart */}
      {points.length > 1 && (
        <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          {[{ color: "#16a34a", label: "กำไร" }, { color: "#dc2626", label: "ขาดทุน" }].map((leg) => (
            <div key={leg.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: leg.color }} />
              <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{leg.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

