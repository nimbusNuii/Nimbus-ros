"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";

type KitchenItem = {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  kitchenState: "NEW" | "PREPARING" | "READY" | "SERVED";
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    total: number;
  };
};

const STATES: Array<KitchenItem["kitchenState"]> = ["NEW", "PREPARING", "READY"];

const stateLabel: Record<KitchenItem["kitchenState"], string> = {
  NEW: "รอทำ",
  PREPARING: "กำลังทำ",
  READY: "พร้อมเสิร์ฟ",
  SERVED: "เสิร์ฟแล้ว"
};

export function KitchenBoard() {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/kitchen", { cache: "no-store" });
      const data = await response.json();
      setItems(data);
    } catch {
      setItems([]);
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

  async function move(item: KitchenItem) {
    const nextState =
      item.kitchenState === "NEW"
        ? "PREPARING"
        : item.kitchenState === "PREPARING"
          ? "READY"
          : "SERVED";

    await fetch("/api/kitchen", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: item.id, kitchenState: nextState })
    });

    await load();
  }

  const grouped = useMemo(() => {
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

  if (loading) {
    return <p>กำลังโหลดคิวครัว...</p>;
  }

  return (
    <div className="grid grid-3">
      {STATES.map((state) => (
        <section className="card" key={state}>
          <h3 style={{ marginTop: 0 }}>{stateLabel[state]}</h3>
          {grouped[state].length === 0 ? <p style={{ color: "var(--muted)" }}>ไม่มีรายการ</p> : null}
          {grouped[state].map((item) => (
            <article
              key={item.id}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 10,
                marginBottom: 10,
                background: "#fff"
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{item.order.orderNumber}</div>
              <strong>{item.name} x{item.qty}</strong>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{formatDateTime(item.order.createdAt)}</div>
              {item.note ? <div style={{ marginTop: 6 }}>หมายเหตุ: {item.note}</div> : null}
              <button onClick={() => move(item)} style={{ width: "100%", marginTop: 8 }}>
                {item.kitchenState === "READY" ? "เสิร์ฟแล้ว" : "เปลี่ยนสถานะ"}
              </button>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
