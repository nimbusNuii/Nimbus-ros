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

  const getStatusLabel = (status: ReceiptSummary["status"]) => {
    if (status === "PAID") return "ชำระแล้ว";
    if (status === "OPEN") return "บิลล่วงหน้า";
    return "ยกเลิก";
  };

  const getStatusClass = (status: ReceiptSummary["status"]) => {
    if (status === "PAID") return "bg-emerald-50 text-emerald-700";
    if (status === "OPEN") return "bg-amber-50 text-amber-700";
    return "bg-rose-50 text-rose-700";
  };

  return (
    <>
      <section className="card mb-3.5 sm:mb-4">
        <form onSubmit={onSubmit} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="field mb-0">
              <label htmlFor="fromDate">ตั้งแต่</label>
              <input id="fromDate" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="field mb-0">
              <label htmlFor="toDate">ถึง</label>
              <input id="toDate" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-2 lg:justify-end lg:self-end">
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
        <h2 className="mt-0 text-xl font-semibold">ใบเสร็จย้อนหลัง</h2>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-[var(--muted)]">กำลังโหลด...</p> : null}

        {!loading ? (
          <>
            <div className="space-y-2 md:hidden">
              {rows.map((row) => (
                <article key={row.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="m-0 text-sm text-[var(--muted)]">{formatDateTime(row.createdAt)}</p>
                      <p className="m-0 text-base font-semibold">{row.orderNumber}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(row.status)}`}>
                      {getStatusLabel(row.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p className="m-0 text-[var(--muted)]">
                      จำนวน: <span className="font-medium text-[var(--text)]">{row.itemCount}</span>
                    </p>
                    <p className="m-0 text-[var(--muted)]">
                      ชำระ: <span className="font-medium text-[var(--text)]">{row.paymentMethod}</span>
                    </p>
                  </div>
                  <p className="mb-0 mt-2 text-base font-semibold">{formatCurrency(row.total, currency)}</p>
                  {row.scheduledFor ? (
                    <p className="mb-0 mt-1 text-xs text-[var(--muted)]">นัดไว้: {formatDateTime(row.scheduledFor)}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="secondary" onClick={() => setSelectedOrderId(row.id)}>
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
                </article>
              ))}
              {rows.length === 0 ? <p className="py-6 text-center text-sm text-[var(--muted)]">ไม่พบใบเสร็จ</p> : null}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="table min-w-[760px]">
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
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(row.status)}`}>
                          {getStatusLabel(row.status)}
                        </span>
                        {row.scheduledFor ? (
                          <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
                            นัดไว้: {formatDateTime(row.scheduledFor)}
                          </p>
                        ) : null}
                      </td>
                      <td>{row.itemCount}</td>
                      <td>{row.paymentMethod}</td>
                      <td>{formatCurrency(row.total, currency)}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="secondary" onClick={() => setSelectedOrderId(row.id)}>
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
                      <td colSpan={7} className="text-center text-[var(--muted)]">
                        ไม่พบใบเสร็จ
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <ReceiptPreviewModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}
