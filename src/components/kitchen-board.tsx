"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";

type KitchenStatus = "NEW" | "PREPARING" | "READY" | "SERVED";
type KitchenViewMode = "ORDER" | "ITEM";

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
  NEW: "รอทำ",
  PREPARING: "กำลังทำ",
  READY: "พร้อมเสิร์ฟ",
  SERVED: "เสิร์ฟแล้ว"
};

function nextState(state: KitchenStatus): KitchenStatus {
  if (state === "NEW") return "PREPARING";
  if (state === "PREPARING") return "READY";
  return "SERVED";
}

function customerLabel(order: KitchenItem["order"]) {
  return order.customerName || (order.customerType === "REGULAR" ? "ลูกค้าประจำ" : "ลูกค้าขาจร");
}

function stateRank(state: KitchenStatus): number {
  if (state === "NEW") return 0;
  if (state === "PREPARING") return 1;
  if (state === "READY") return 2;
  return 3;
}

export function KitchenBoard() {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [mode, setMode] = useState<KitchenViewMode>("ORDER");
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/kitchen", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("cannot load kitchen queue");
      }
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
    }, 5000);

    return () => clearInterval(timer);
  }, [load]);

  async function moveItem(item: KitchenItem) {
    if (updatingKey) return;
    const next = nextState(item.kitchenState);
    setUpdatingKey(`item:${item.id}`);

    try {
      const response = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, kitchenState: next })
      });

      if (!response.ok) {
        throw new Error("update item failed");
      }

      await load();
    } catch {
      setError("อัปเดตสถานะเมนูไม่สำเร็จ");
    } finally {
      setUpdatingKey(null);
    }
  }

  async function moveOrder(orderId: string) {
    if (updatingKey) return;
    setUpdatingKey(`order:${orderId}`);

    try {
      const response = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId })
      });

      if (!response.ok) {
        throw new Error("update order failed");
      }

      await load();
    } catch {
      setError("อัปเดตสถานะออเดอร์ไม่สำเร็จ");
    } finally {
      setUpdatingKey(null);
    }
  }

  const groupedItems = useMemo(() => {
    const map: Record<string, KitchenItem[]> = {
      NEW: [],
      PREPARING: [],
      READY: []
    };

    for (const item of items) {
      if (map[item.kitchenState]) {
        map[item.kitchenState].push(item);
      }
    }

    return map;
  }, [items]);

  const groupedOrders = useMemo(() => {
    const orderMap = new Map<string, KitchenOrder>();

    for (const item of items) {
      const existing = orderMap.get(item.order.id);
      if (!existing) {
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

      existing.items.push(item);
      if (item.kitchenState === "NEW") existing.counts.NEW += 1;
      if (item.kitchenState === "PREPARING") existing.counts.PREPARING += 1;
      if (item.kitchenState === "READY") existing.counts.READY += 1;
      if (stateRank(item.kitchenState) < stateRank(existing.kitchenState)) {
        existing.kitchenState = item.kitchenState as "NEW" | "PREPARING" | "READY";
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
  }, [items]);

  if (loading) {
    return <p>กำลังโหลดคิวครัว...</p>;
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>รูปแบบการทำอาหาร</h3>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>เลือกได้ว่าจะเลื่อนสถานะแบบทีละออเดอร์ หรือทีละเมนู</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={mode === "ORDER" ? "" : "secondary"} onClick={() => setMode("ORDER")}>
              ทีละคำสั่งซื้อ
            </button>
            <button type="button" className={mode === "ITEM" ? "" : "secondary"} onClick={() => setMode("ITEM")}>
              ทีละเมนู
            </button>
          </div>
        </div>
        {error ? <p style={{ marginBottom: 0, color: "crimson" }}>{error}</p> : null}
      </section>

      <div className="grid grid-3">
        {STATES.map((state) => (
          <section className="card" key={state}>
            <h3 style={{ marginTop: 0 }}>{stateLabel[state]}</h3>

            {mode === "ORDER" ? (
              <>
                {groupedOrders[state].length === 0 ? <p style={{ color: "var(--muted)" }}>ไม่มีออเดอร์</p> : null}
                {groupedOrders[state].map((order) => (
                  <article
                    key={order.id}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 10,
                      background: "var(--surface-strong)"
                    }}
                  >
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{order.orderNumber}</div>
                    <strong>{customerLabel(order)}</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{formatDateTime(order.createdAt)}</div>
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                      เมนู {order.items.length} รายการ (รอทำ {order.counts.NEW}, กำลังทำ {order.counts.PREPARING}, พร้อมเสิร์ฟ {order.counts.READY})
                    </div>
                    <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                      {order.items.map((item) => (
                        <div key={item.id} style={{ fontSize: 13 }}>
                          {item.name} x{item.qty}
                          {item.note ? <span style={{ color: "var(--muted)" }}> ({item.note})</span> : null}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => moveOrder(order.id)}
                      disabled={Boolean(updatingKey)}
                      style={{ width: "100%", marginTop: 10 }}
                    >
                      {updatingKey === `order:${order.id}`
                        ? "กำลังอัปเดต..."
                        : state === "READY"
                          ? "เสิร์ฟทั้งออเดอร์"
                          : state === "PREPARING"
                            ? "ทำทั้งออเดอร์ให้พร้อมเสิร์ฟ"
                            : "เริ่มทำทั้งออเดอร์"}
                    </button>
                  </article>
                ))}
              </>
            ) : (
              <>
                {groupedItems[state].length === 0 ? <p style={{ color: "var(--muted)" }}>ไม่มีรายการ</p> : null}
                {groupedItems[state].map((item) => (
                  <article
                    key={item.id}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 10,
                      background: "var(--surface-strong)"
                    }}
                  >
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{item.order.orderNumber}</div>
                    <strong>
                      {item.name} x{item.qty}
                    </strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{customerLabel(item.order)}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{formatDateTime(item.order.createdAt)}</div>
                    {item.note ? <div style={{ marginTop: 6 }}>หมายเหตุ: {item.note}</div> : null}
                    <button onClick={() => moveItem(item)} disabled={Boolean(updatingKey)} style={{ width: "100%", marginTop: 8 }}>
                      {updatingKey === `item:${item.id}`
                        ? "กำลังอัปเดต..."
                        : item.kitchenState === "READY"
                          ? "เสิร์ฟเมนูนี้"
                          : item.kitchenState === "PREPARING"
                            ? "ทำเมนูนี้เสร็จ"
                            : "เริ่มทำเมนูนี้"}
                    </button>
                  </article>
                ))}
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
