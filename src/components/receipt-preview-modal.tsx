"use client";

import { useEffect, useState } from "react";
import { ReceiptDocument } from "@/components/receipt-document";

type ReceiptPayload = {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: Array<{
      id: string;
      name: string;
      qty: number;
      unitPrice: number;
      unitCost: number;
      lineTotal: number;
    }>;
  };
  store: {
    businessName: string;
    branchName: string | null;
    address: string | null;
    phone: string | null;
    vatNumber: string | null;
    currency: string;
  };
  template: {
    headerText: string;
    footerText: string;
    showStoreInfo: boolean;
    showVatNumber: boolean;
    showCostBreakdown: boolean;
    paperWidth: number;
    customCss: string | null;
  };
};

type ReceiptPreviewModalProps = {
  orderId: string | null;
  onClose: () => void;
};

export function ReceiptPreviewModal({ orderId, onClose }: ReceiptPreviewModalProps) {
  const [data, setData] = useState<ReceiptPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queueing, setQueueing] = useState(false);
  const [printerTarget, setPrinterTarget] = useState("");

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const response = await fetch(`/api/receipts/${orderId}`, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Cannot load receipt");
        }

        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Cannot load receipt");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function enqueue(channel: "CASHIER_RECEIPT" | "KITCHEN_TICKET") {
    if (!orderId) return;

    setQueueing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/print/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          orderId,
          channel,
          printerTarget: printerTarget.trim() || undefined
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Cannot enqueue print");
      }

      setMessage(`ส่งคิวแล้ว (${payload.id})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot enqueue print");
    } finally {
      setQueueing(false);
    }
  }

  if (!orderId) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header hide-print">
          <h3 style={{ margin: 0 }}>พรีวิวใบเสร็จ</h3>
          <button className="secondary" onClick={onClose}>
            ปิด
          </button>
        </div>

        <div className="hide-print" style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => window.print()}>พิมพ์จาก Browser</button>
          <input
            value={printerTarget}
            onChange={(event) => setPrinterTarget(event.target.value)}
            placeholder="target (optional): cashier / kitchen"
            style={{ minWidth: 220 }}
          />
          <button className="secondary" disabled={queueing} onClick={() => void enqueue("CASHIER_RECEIPT")}>
            {queueing ? "กำลังส่ง..." : "คิวใบเสร็จ"}
          </button>
          <button className="secondary" disabled={queueing} onClick={() => void enqueue("KITCHEN_TICKET")}>
            {queueing ? "กำลังส่ง..." : "คิวบิลครัว"}
          </button>
        </div>

        {message ? <p className="hide-print" style={{ color: "var(--ok)", marginTop: 0 }}>{message}</p> : null}
        {error ? <p className="hide-print" style={{ color: "crimson", marginTop: 0 }}>{error}</p> : null}

        {loading ? <p>กำลังโหลดใบเสร็จ...</p> : null}

        {data ? (
          <ReceiptDocument
            order={data.order}
            store={data.store}
            template={data.template}
          />
        ) : null}
      </div>
    </div>
  );
}
