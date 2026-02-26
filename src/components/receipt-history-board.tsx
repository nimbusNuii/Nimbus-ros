"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ReceiptPreviewModal } from "@/components/receipt-preview-modal";
import { useRealtime } from "@/lib/use-realtime";

type ReceiptSummary = {
  id: string;
  orderNumber: string;
  paymentMethod: string;
  status: "PAID" | "OPEN" | "CANCELLED";
  scheduledFor: string | null;
  createdAt: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  itemCount: number;
};

type ReceiptHistoryBoardProps = {
  currency: string;
};

export function ReceiptHistoryBoard({ currency }: ReceiptHistoryBoardProps) {
  const todayText = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<ReceiptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(todayText);
  const [to, setTo] = useState(todayText);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const buildQuery = (fromValue: string, toValue: string) => {
    const params = new URLSearchParams({ limit: "300" });
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    return params.toString();
  };

  const query = useMemo(() => buildQuery(from, to), [from, to]);

  async function load(queryValue = query) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/receipts?${queryValue}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Cannot load receipts");
      }

      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load receipts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtime((event) => {
    if (event.type === "order.created" || event.type === "order.updated") {
      void load();
    }
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load();
  }

  async function cancelBill(orderId: string) {
    if (!window.confirm("ยืนยันยกเลิกบิลนี้?")) return;
    setUpdatingId(orderId);
    setError("");

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot cancel bill");
      }
      setRows((prev) => prev.map((row) => (row.id === orderId ? { ...row, status: "CANCELLED" } : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot cancel bill");
    } finally {
      setUpdatingId(null);
    }
  }

  async function markPaid(orderId: string) {
    setUpdatingId(orderId);
    setError("");

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "MARK_PAID" })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot mark bill paid");
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === orderId
            ? {
                ...row,
                status: "PAID",
                paymentMethod: data.paymentMethod || row.paymentMethod,
                scheduledFor: null
              }
            : row
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot mark bill paid");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 14 }}>
        <form onSubmit={onSubmit}>
          <div className="grid grid-3" style={{ alignItems: "end" }}>
            <div className="field">
              <label htmlFor="fromDate">ตั้งแต่</label>
              <input id="fromDate" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="toDate">ถึง</label>
              <input id="toDate" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={loading}>
                ค้นหา
              </button>
              <button
                type="button"
                className="secondary"
                disabled={loading}
                onClick={() => {
                  setFrom(todayText);
                  setTo(todayText);
                  void load(buildQuery(todayText, todayText));
                }}
              >
                รีเซ็ต
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>ใบเสร็จย้อนหลัง</h2>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        {loading ? <p style={{ color: "var(--muted)" }}>กำลังโหลด...</p> : null}

        {!loading ? (
          <table className="table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>เลขที่</th>
                <th>สถานะ</th>
                <th>จำนวนรายการ</th>
                <th>ชำระเงิน</th>
                <th>ยอดสุทธิ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.orderNumber}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        row.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700"
                          : row.status === "OPEN"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {row.status === "PAID" ? "ชำระแล้ว" : row.status === "OPEN" ? "บิลล่วงหน้า" : "ยกเลิก"}
                    </span>
                    {row.scheduledFor ? (
                      <p className="mb-0 mt-1 text-xs text-[var(--muted)]">นัดไว้: {formatDateTime(row.scheduledFor)}</p>
                    ) : null}
                  </td>
                  <td>{row.itemCount}</td>
                  <td>{row.paymentMethod}</td>
                  <td>{formatCurrency(row.total, currency)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="secondary" onClick={() => setSelectedOrderId(row.id)}>
                        ดู/พิมพ์
                      </button>
                      {row.status === "OPEN" ? (
                        <button
                          type="button"
                          className="secondary"
                          disabled={updatingId === row.id}
                          onClick={() => void markPaid(row.id)}
                        >
                          {updatingId === row.id ? "..." : "ชำระแล้ว"}
                        </button>
                      ) : null}
                      {row.status !== "CANCELLED" ? (
                        <button
                          type="button"
                          className="secondary"
                          disabled={updatingId === row.id}
                          onClick={() => void cancelBill(row.id)}
                        >
                          {updatingId === row.id ? "..." : "ยกเลิกบิล"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                    ไม่พบใบเสร็จ
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </section>

      <ReceiptPreviewModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}
