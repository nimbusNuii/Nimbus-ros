"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ReceiptPreviewModal } from "@/components/receipt-preview-modal";

type ReceiptSummary = {
  id: string;
  orderNumber: string;
  paymentMethod: string;
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
  const [rows, setRows] = useState<ReceiptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "300" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [from, to]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/receipts?${query}`, { cache: "no-store" });
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load();
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
                  setFrom("");
                  setTo("");
                  void load();
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
                  <td>{row.itemCount}</td>
                  <td>{row.paymentMethod}</td>
                  <td>{formatCurrency(row.total, currency)}</td>
                  <td>
                    <button className="secondary" onClick={() => setSelectedOrderId(row.id)}>
                      ดู/พิมพ์
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
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
