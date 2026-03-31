"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtime } from "@/lib/use-realtime";

type KitchenStatus = "NEW" | "PREPARING" | "READY" | "SERVED";
type KitchenViewMode = "ORDER" | "ITEM";
type StationFilter = "ALL" | "GRILL" | "WOK" | "DRINKS";

type KitchenItem = {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  kitchenState: KitchenStatus;
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    customerType: "WALK_IN" | "REGULAR";
    customerName: string | null;
    total: number;
  };
};

type KitchenOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerType: "WALK_IN" | "REGULAR";
  customerName: string | null;
  total: number;
  kitchenState: "NEW" | "PREPARING" | "READY";
  items: KitchenItem[];
  counts: {
    NEW: number;
    PREPARING: number;
    READY: number;
  };
};

const STATES: Array<"NEW" | "PREPARING" | "READY"> = ["NEW", "PREPARING", "READY"];

const stateLabel: Record<KitchenStatus, string> = {
  NEW: "ใหม่",
  PREPARING: "กำลังทำ",
  READY: "พร้อมเสิร์ฟ",
  SERVED: "เสิร์ฟแล้ว"
};

function customerLabel(order: KitchenItem["order"]) {
  return order.customerName || (order.customerType === "REGULAR" ? "ลูกค้าประจำ" : "ลูกค้า");
}

function inferStation(name: string): StationFilter {
  const value = name.toLowerCase();
  if (value.includes("ชาบู") || value.includes("หมูย่าง") || value.includes("เนื้อย่าง") || value.includes("grill")) {
    return "GRILL";
  }
  if (value.includes("กาแฟ") || value.includes("ชา") || value.includes("น้ำ") || value.includes("drink")) {
    return "DRINKS";
  }
  return "WOK";
}

function statusRank(state: KitchenStatus) {
  if (state === "NEW") return 0;
  if (state === "PREPARING") return 1;
  if (state === "READY") return 2;
  return 3;
}

function nextKitchenAction(state: KitchenStatus): { label: string; target: KitchenStatus } | null {
  if (state === "NEW") return { label: "START", target: "PREPARING" };
  if (state === "PREPARING") return { label: "READY", target: "READY" };
  if (state === "READY") return { label: "SERVED", target: "SERVED" };
  return null;
}

function elapsedText(createdAt: string, nowMs: number) {
  const deltaSec = Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 1000));
  const hour = Math.floor(deltaSec / 3600);
  const minute = Math.floor((deltaSec % 3600) / 60);
  const sec = deltaSec % 60;
  if (hour > 0) return `${hour}h ${minute}m`;
  return `${minute}:${sec.toString().padStart(2, "0")}`;
}

/* ─────────────────────── Icons ─────────────────────── */
const IconKitchen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 11l19-9-9 19-2-8-8-2z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconClock = ({ color = "#64748b" }: { color?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconEmpty = ({ color = "#94a3b8" }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <rect x="9" y="3" width="6" height="4" rx="1" stroke={color} strokeWidth="2" />
  </svg>
);
const ActionIcon = ({ target }: { target: KitchenStatus }) => {
  if (target === "PREPARING") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  if (target === "READY") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
};

export function KitchenBoard() {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [mode, setMode] = useState<KitchenViewMode>("ORDER");
  const [station, setStation] = useState<StationFilter>("ALL");
  const [activeLane, setActiveLane] = useState<"NEW" | "PREPARING" | "READY">("NEW");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/kitchen", { cache: "no-store" });
      if (!response.ok) throw new Error("cannot load kitchen queue");
      const data = await response.json();
      setItems(data);
      setError("");
    } catch {
      setItems([]);
      setError("โหลดคิวครัวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  useRealtime((event) => {
    if (event.type === "order.created" || event.type === "order.updated" || event.type === "kitchen.updated") {
      void load();
    }
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function moveItem(itemId: string, kitchenState: KitchenStatus) {
    if (updatingKey) return;
    setUpdatingKey(`item:${itemId}:${kitchenState}`);

    try {
      const response = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, kitchenState })
      });
      if (!response.ok) throw new Error("update item failed");
      await load();
    } catch {
      setError("อัปเดตสถานะเมนูไม่สำเร็จ");
    } finally {
      setUpdatingKey(null);
    }
  }

  async function moveOrder(orderId: string, kitchenState: KitchenStatus) {
    if (updatingKey) return;
    setUpdatingKey(`order:${orderId}:${kitchenState}`);

    try {
      const response = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, kitchenState })
      });
      if (!response.ok) throw new Error("update order failed");
      await load();
    } catch {
      setError("อัปเดตสถานะออเดอร์ไม่สำเร็จ");
    } finally {
      setUpdatingKey(null);
    }
  }

  const filteredItems = useMemo(() => {
    if (station === "ALL") return items;
    return items.filter((item) => inferStation(item.name) === station);
  }, [items, station]);

  const groupedItems = useMemo(() => {
    const map: Record<string, KitchenItem[]> = {
      NEW: [],
      PREPARING: [],
      READY: []
    };
    for (const item of filteredItems) {
      if (map[item.kitchenState]) map[item.kitchenState].push(item);
    }
    return map;
  }, [filteredItems]);

  const groupedOrders = useMemo(() => {
    const orderMap = new Map<string, KitchenOrder>();

    for (const item of filteredItems) {
      const current = orderMap.get(item.order.id);
      if (!current) {
        orderMap.set(item.order.id, {
          id: item.order.id,
          orderNumber: item.order.orderNumber,
          createdAt: item.order.createdAt,
          customerType: item.order.customerType,
          customerName: item.order.customerName,
          total: item.order.total,
          kitchenState: item.kitchenState === "PREPARING" || item.kitchenState === "READY" ? item.kitchenState : "NEW",
          items: [item],
          counts: {
            NEW: item.kitchenState === "NEW" ? 1 : 0,
            PREPARING: item.kitchenState === "PREPARING" ? 1 : 0,
            READY: item.kitchenState === "READY" ? 1 : 0
          }
        });
        continue;
      }

      current.items.push(item);
      if (item.kitchenState === "NEW") current.counts.NEW += 1;
      if (item.kitchenState === "PREPARING") current.counts.PREPARING += 1;
      if (item.kitchenState === "READY") current.counts.READY += 1;
      if (statusRank(item.kitchenState) < statusRank(current.kitchenState)) {
        current.kitchenState = item.kitchenState as "NEW" | "PREPARING" | "READY";
      }
    }

    const grouped: Record<string, KitchenOrder[]> = {
      NEW: [],
      PREPARING: [],
      READY: []
    };
    for (const order of orderMap.values()) {
      grouped[order.kitchenState].push(order);
    }
    for (const state of STATES) {
      grouped[state].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return grouped;
  }, [filteredItems]);

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ height: 72, borderRadius: 16, background: "var(--line)", opacity: 0.5, animation: "kds-shimmer 1.4s ease infinite" }} />
        <div style={{ display: "grid", gap: 12 }} className="xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ borderRadius: 16, background: "var(--line)", height: 320, opacity: 0.35, animationDelay: `${i * 0.15}s`, animation: "kds-shimmer 1.4s ease infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  /* ─── Lane config ─── */
  const laneConfig: Record<"NEW" | "PREPARING" | "READY", {
    label: string; headerBg: string; headerText: string; headerBorder: string; dotColor: string;
  }> = {
    NEW:       { label: "รอทำ",        headerBg: "#f1f5f9", headerText: "#334155", headerBorder: "#cbd5e1", dotColor: "#64748b" },
    PREPARING: { label: "กำลังทำ",    headerBg: "#fffbeb", headerText: "#92400e", headerBorder: "#fcd34d", dotColor: "#f59e0b" },
    READY:     { label: "พร้อมเสิร์ฟ", headerBg: "#f0fdf4", headerText: "#166534", headerBorder: "#86efac", dotColor: "#16a34a" },
  };

  const mobileLanes: Array<"NEW" | "PREPARING" | "READY"> = ["NEW", "PREPARING", "READY"];

  const totalCount = (state: "NEW" | "PREPARING" | "READY") =>
    mode === "ORDER" ? groupedOrders[state].length : groupedItems[state].length;

  return (
    <>
      <style>{`
        @keyframes kds-shimmer { 0%,100% { opacity: 0.35 } 50% { opacity: 0.18 } }
        @keyframes kds-pulse-red { 0%,100% { border-color: #dc2626; box-shadow: 0 0 0 0 rgba(220,38,38,0) } 50% { border-color: #dc2626; box-shadow: 0 0 0 4px rgba(220,38,38,0.15) } }
        @keyframes kds-spin { to { transform: rotate(360deg); } }
        .kds-card-new      { border-color: #e2e8f0; }
        .kds-card-preparing{ border-color: #fcd34d; border-width: 2px; }
        .kds-card-ready    { border-color: #86efac; border-width: 2px; }
        .kds-card-delayed  { animation: kds-pulse-red 1.6s ease infinite; border-width: 2px; }
        .kds-action-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .kds-action-btn:active:not(:disabled) { transform: scale(0.97); }
        .kds-tab:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
      `}</style>

      {/* ── Control bar ── */}
      <div style={{
        position: "sticky", top: 64, zIndex: 20,
        background: "var(--bg)", borderBottom: "1px solid var(--line)",
        padding: "12px 0 12px", marginBottom: 16,
        marginLeft: "calc(-1 * clamp(16px, 3vw, 28px))",
        marginRight: "calc(-1 * clamp(16px, 3vw, 28px))",
        paddingLeft: "clamp(16px, 3vw, 28px)",
        paddingRight: "clamp(16px, 3vw, 28px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>

          {/* Title + live dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconKitchen />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>Kitchen Display</p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.68rem", fontWeight: 600, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 20, padding: "1px 8px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "none" }} />
                  LIVE
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.2 }}>หน้าจอครัวแบบเรียลไทม์</p>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
              {(["ORDER", "ITEM"] as KitchenViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="kds-tab"
                  style={{
                    height: 34, padding: "0 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: "0.78rem", fontWeight: mode === m ? 700 : 500,
                    background: mode === m ? "#fff" : "transparent",
                    color: mode === m ? "var(--text)" : "var(--muted)",
                    boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                    transition: "all 150ms ease",
                  }}
                >
                  {m === "ORDER" ? "ทีละออเดอร์" : "ทีละเมนู"}
                </button>
              ))}
            </div>

            {/* Station filter */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["ALL", "GRILL", "WOK", "DRINKS"] as StationFilter[]).map((key) => {
                const active = station === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStation(key)}
                    className="kds-tab"
                    style={{
                      height: 34, padding: "0 12px", borderRadius: 9, cursor: "pointer",
                      fontSize: "0.78rem", fontWeight: active ? 700 : 400,
                      border: active ? "2px solid var(--brand)" : "1px solid var(--line)",
                      background: active ? "var(--brand-light)" : "#fff",
                      color: active ? "var(--brand)" : "var(--muted)",
                      transition: "all 130ms ease",
                    }}
                  >
                    {key === "ALL" ? "ทั้งหมด" : key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "#dc2626", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            {error}
          </p>
        )}
      </div>

      {/* ── Mobile lane tabs ── */}
      <div className="flex xl:hidden" style={{ gap: 6, marginBottom: 14, overflowX: "auto", scrollbarWidth: "none" }}>
        {mobileLanes.map((s) => {
          const cfg = laneConfig[s];
          const count = totalCount(s);
          const active = activeLane === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveLane(s)}
              className="kds-tab"
              style={{
                height: 38, padding: "0 16px", borderRadius: 10, cursor: "pointer", flexShrink: 0,
                border: active ? `2px solid ${cfg.dotColor}` : "1px solid var(--line)",
                background: active ? cfg.headerBg : "#fff",
                color: active ? cfg.headerText : "var(--muted)",
                fontSize: "0.82rem", fontWeight: active ? 700 : 500,
                display: "flex", alignItems: "center", gap: 6, transition: "all 150ms ease",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dotColor }} />
              {cfg.label}
              <span style={{
                minWidth: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? cfg.dotColor : "var(--line)", color: active ? "#fff" : "var(--muted)",
                fontSize: "0.7rem", fontWeight: 700, padding: "0 5px",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Desktop 3-col / Mobile single lane ── */}
      <div style={{ display: "grid", gap: 14, alignItems: "start" }} className="xl:grid-cols-3">
        {STATES.map((state) => {
          const cfg = laneConfig[state];
          const count = totalCount(state);
          return (
            <div
              key={state}
              className={state !== activeLane ? "hidden xl:flex xl:flex-col" : "flex flex-col"}
              style={{ minWidth: 0 }}
            >
              {/* Lane header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: "14px 14px 0 0",
                background: cfg.headerBg, border: `1px solid ${cfg.headerBorder}`, borderBottom: "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: cfg.headerText }}>{cfg.label}</span>
                </div>
                <span style={{
                  minWidth: 26, height: 22, borderRadius: 11,
                  background: cfg.dotColor, color: "#fff",
                  fontSize: "0.72rem", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "0 7px",
                }}>
                  {count}
                </span>
              </div>

              {/* Cards container */}
              <div style={{
                border: `1px solid ${cfg.headerBorder}`, borderTop: "none", borderRadius: "0 0 14px 14px",
                background: "#f8fafc", padding: "10px 10px 12px",
                display: "flex", flexDirection: "column", gap: 10,
                maxHeight: "calc(100dvh - 64px - 130px)", overflowY: "auto",
                overscrollBehavior: "contain",
              }}>
                {/* ── Empty state ── */}
                {count === 0 && (
                  <div style={{ padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: cfg.headerBg, border: `1px solid ${cfg.headerBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconEmpty color={cfg.dotColor} />
                    </div>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", textAlign: "center" }}>ไม่มีรายการ</p>
                  </div>
                )}

                {/* ── ORDER mode ── */}
                {mode === "ORDER" && groupedOrders[state].map((order) => {
                  const delayed = Date.now() - new Date(order.createdAt).getTime() > 15 * 60 * 1000 && order.kitchenState !== "READY";
                  const elapsed = elapsedText(order.createdAt, tick);
                  const action = nextKitchenAction(order.kitchenState);
                  const isUpdating = updatingKey === `order:${order.id}:${action?.target}`;
                  const cardClass = delayed ? "kds-card-delayed" : state === "PREPARING" ? "kds-card-preparing" : state === "READY" ? "kds-card-ready" : "kds-card-new";
                  return (
                    <article
                      key={order.id}
                      className={cardClass}
                      style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      {/* Header: order# + timer */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                            #{order.orderNumber}
                          </p>
                          <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
                            {order.customerName || (order.customerType === "REGULAR" ? "ลูกค้าประจำ" : "ลูกค้า")}
                          </p>
                        </div>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                          background: delayed ? "#fef2f2" : "#f8fafc",
                          border: `1px solid ${delayed ? "#fca5a5" : "#e2e8f0"}`,
                          borderRadius: 20, padding: "4px 10px",
                        }}>
                          <IconClock color={delayed ? "#dc2626" : "#64748b"} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 700, color: delayed ? "#dc2626" : "#334155", fontVariantNumeric: "tabular-nums" }}>
                            {elapsed}
                          </span>
                        </div>
                      </div>

                      {/* Item chips */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 8,
                              background: item.kitchenState === "READY" ? "#f0fdf4" : item.kitchenState === "PREPARING" ? "#fffbeb" : "#f8fafc",
                              border: `1px solid ${item.kitchenState === "READY" ? "#bbf7d0" : item.kitchenState === "PREPARING" ? "#fde68a" : "#e2e8f0"}`,
                              borderRadius: 9, padding: "7px 10px",
                            }}
                          >
                            <span style={{
                              minWidth: 28, height: 22, borderRadius: 6, flexShrink: 0,
                              background: item.kitchenState === "READY" ? "#16a34a" : item.kitchenState === "PREPARING" ? "#f59e0b" : "#94a3b8",
                              color: "#fff", fontSize: "0.7rem", fontWeight: 800,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>×{item.qty}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.name}
                              </p>
                              {item.note && (
                                <p style={{ margin: "2px 0 0", fontSize: "0.72rem", fontWeight: 600, color: "#dc2626" }}>
                                  ⚠ {item.note}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action button */}
                      {action && (
                        <button
                          type="button"
                          disabled={Boolean(updatingKey)}
                          onClick={() => void moveOrder(order.id, action.target)}
                          className="kds-action-btn"
                          style={{
                            width: "100%", height: 44, borderRadius: 10, border: "none",
                            background: action.target === "PREPARING" ? "#f59e0b" : action.target === "READY" ? "#16a34a" : "var(--brand)",
                            color: "#fff", fontSize: "0.875rem", fontWeight: 700,
                            cursor: Boolean(updatingKey) ? "not-allowed" : "pointer",
                            opacity: Boolean(updatingKey) ? 0.7 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            transition: "all 150ms ease",
                          }}
                        >
                          {isUpdating ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "kds-spin 0.7s linear infinite" }} aria-hidden="true"><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                          ) : (
                            <ActionIcon target={action.target} />
                          )}
                          {action.label}
                        </button>
                      )}
                    </article>
                  );
                })}

                {/* ── ITEM mode ── */}
                {mode === "ITEM" && groupedItems[state].map((item) => {
                  const delayed = Date.now() - new Date(item.order.createdAt).getTime() > 15 * 60 * 1000 && item.kitchenState !== "READY";
                  const elapsed = elapsedText(item.order.createdAt, tick);
                  const action = nextKitchenAction(item.kitchenState);
                  const isUpdating = updatingKey === `item:${item.id}:${action?.target}`;
                  const cardClass = delayed ? "kds-card-delayed" : state === "PREPARING" ? "kds-card-preparing" : state === "READY" ? "kds-card-ready" : "kds-card-new";
                  return (
                    <article
                      key={item.id}
                      className={cardClass}
                      style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      {/* Order ref + timer */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>
                          #{item.order.orderNumber}
                        </span>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 4,
                          background: delayed ? "#fef2f2" : "#f8fafc",
                          border: `1px solid ${delayed ? "#fca5a5" : "#e2e8f0"}`,
                          borderRadius: 20, padding: "3px 8px",
                        }}>
                          <IconClock color={delayed ? "#dc2626" : "#64748b"} />
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: delayed ? "#dc2626" : "#334155", fontVariantNumeric: "tabular-nums" }}>
                            {elapsed}
                          </span>
                        </div>
                      </div>

                      {/* Item name + qty */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          minWidth: 36, height: 28, borderRadius: 7, flexShrink: 0,
                          background: state === "READY" ? "#16a34a" : state === "PREPARING" ? "#f59e0b" : "#94a3b8",
                          color: "#fff", fontSize: "0.82rem", fontWeight: 800,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>×{item.qty}</span>
                        <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
                          {item.name}
                        </p>
                      </div>

                      {/* Customer + note */}
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>
                        {item.order.customerName || (item.order.customerType === "REGULAR" ? "ลูกค้าประจำ" : "ลูกค้า")}
                      </p>
                      {item.note && (
                        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, color: "#dc2626", background: "#fef2f2", borderRadius: 6, padding: "4px 8px" }}>
                          ⚠ {item.note}
                        </p>
                      )}

                      {/* Action button */}
                      {action && (
                        <button
                          type="button"
                          disabled={Boolean(updatingKey)}
                          onClick={() => void moveItem(item.id, action.target)}
                          className="kds-action-btn"
                          style={{
                            width: "100%", height: 44, borderRadius: 10, border: "none",
                            background: action.target === "PREPARING" ? "#f59e0b" : action.target === "READY" ? "#16a34a" : "var(--brand)",
                            color: "#fff", fontSize: "0.875rem", fontWeight: 700,
                            cursor: Boolean(updatingKey) ? "not-allowed" : "pointer",
                            opacity: Boolean(updatingKey) ? 0.7 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            transition: "all 150ms ease",
                          }}
                        >
                          {isUpdating ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "kds-spin 0.7s linear infinite" }} aria-hidden="true"><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                          ) : (
                            <ActionIcon target={action.target} />
                          )}
                          {action.label}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
