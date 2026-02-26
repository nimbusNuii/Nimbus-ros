"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
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

export function KitchenBoard() {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [mode, setMode] = useState<KitchenViewMode>("ORDER");
  const [station, setStation] = useState<StationFilter>("ALL");
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

  if (loading) return <p>กำลังโหลดคิวครัว...</p>;

  return (
    <>
      <section className="card mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="m-0 text-lg font-semibold">Kitchen Display</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">หน้าจอครัวแบบเรียลไทม์ ลดความผิดพลาดช่วงพีค</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={mode === "ORDER" ? "" : "secondary"} onClick={() => setMode("ORDER")}>
              ทีละออเดอร์
            </button>
            <button type="button" className={mode === "ITEM" ? "" : "secondary"} onClick={() => setMode("ITEM")}>
              ทีละเมนู
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["ALL", "GRILL", "WOK", "DRINKS"] as StationFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className={station === key ? "" : "secondary"}
              onClick={() => setStation(key)}
            >
              {key === "ALL" ? "All" : key}
            </button>
          ))}
        </div>
        {error ? <p className="mb-0 mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <div className="grid gap-3 xl:grid-cols-3">
        {STATES.map((state) => (
          <section className="card" key={state}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="m-0 text-base font-semibold">{stateLabel[state]}</h3>
              <span className="rounded-full border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">
                {mode === "ORDER" ? groupedOrders[state].length : groupedItems[state].length}
              </span>
            </div>

            {mode === "ORDER" ? (
              <div className="space-y-2">
                {groupedOrders[state].length === 0 ? <p className="text-sm text-[var(--muted)]">ไม่มีออเดอร์</p> : null}
                {groupedOrders[state].map((order) => {
                  const elapsed = elapsedText(order.createdAt, tick);
                  const delayed = Date.now() - new Date(order.createdAt).getTime() > 15 * 60 * 1000 && order.kitchenState !== "READY";
                  const action = nextKitchenAction(order.kitchenState);
                  const borderClass = delayed
                    ? "border-[#DC2626] kds-delayed-pulse"
                    : order.kitchenState === "PREPARING"
                      ? "border-[#F59E0B]"
                      : order.kitchenState === "READY"
                        ? "border-[#16A34A]"
                        : "border-[var(--line)]";

                  return (
                    <article key={order.id} className={`rounded-xl border bg-white p-3 ${borderClass}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-2xl font-bold text-[#111827]">#{order.orderNumber}</div>
                          <div className="text-xs text-[var(--muted)]">โต๊ะ: -</div>
                        </div>
                        <div className={`text-lg font-semibold ${delayed ? "text-red-600" : "text-[#111827]"}`}>{elapsed}</div>
                      </div>

                      <div className="mt-1 text-xs text-[var(--muted)]">{customerLabel(order)}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(order.createdAt)}</div>
                      <div className="mt-2 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="rounded-lg border border-[var(--line)] bg-[#fafafa] px-2 py-1">
                            <div className="text-sm font-medium text-[#111827]">
                              {item.name} x{item.qty}
                            </div>
                            {item.note ? <div className="text-xs font-semibold text-[#DC2626]">หมายเหตุ: {item.note}</div> : null}
                          </div>
                        ))}
                      </div>

                      {action ? (
                        <div className="mt-3">
                          <button
                            className="w-full"
                            disabled={Boolean(updatingKey)}
                            onClick={() => void moveOrder(order.id, action.target)}
                          >
                            {action.label}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {groupedItems[state].length === 0 ? <p className="text-sm text-[var(--muted)]">ไม่มีรายการ</p> : null}
                {groupedItems[state].map((item) => {
                  const delayed = Date.now() - new Date(item.order.createdAt).getTime() > 15 * 60 * 1000 && item.kitchenState !== "READY";
                  const action = nextKitchenAction(item.kitchenState);
                  const borderClass = delayed
                    ? "border-[#DC2626] kds-delayed-pulse"
                    : item.kitchenState === "PREPARING"
                      ? "border-[#F59E0B]"
                      : item.kitchenState === "READY"
                        ? "border-[#16A34A]"
                        : "border-[var(--line)]";

                  return (
                    <article key={item.id} className={`rounded-xl border bg-white p-3 ${borderClass}`}>
                      <div className="flex items-start justify-between">
                        <div className="text-sm font-semibold text-[#111827]">#{item.order.orderNumber}</div>
                        <div className={`text-sm font-semibold ${delayed ? "text-red-600" : "text-[#111827]"}`}>
                          {elapsedText(item.order.createdAt, tick)}
                        </div>
                      </div>
                      <div className="text-base font-semibold text-[#111827]">
                        {item.name} x{item.qty}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{customerLabel(item.order)}</div>
                      {item.note ? <div className="mt-1 text-xs font-semibold text-[#DC2626]">หมายเหตุ: {item.note}</div> : null}
                      {action ? (
                        <div className="mt-3">
                          <button
                            className="w-full"
                            disabled={Boolean(updatingKey)}
                            onClick={() => void moveItem(item.id, action.target)}
                          >
                            {action.label}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
