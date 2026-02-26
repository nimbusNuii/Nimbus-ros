"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";

type Product = {
  id: string;
  name: string;
  sku: string | null;
};

type InventoryLog = {
  id: string;
  productId: string;
  orderId: string | null;
  deltaQty: number;
  reason: "SALE" | "ADJUST" | "RESTOCK";
  note: string | null;
  actor: string | null;
  createdAt: string;
  product: Product;
  order: { id: string; orderNumber: string } | null;
};

const reasonLabel: Record<InventoryLog["reason"], string> = {
  SALE: "ขาย",
  ADJUST: "ปรับ",
  RESTOCK: "เติมสต็อก"
};

export function InventoryLogBoard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reason, setReason] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (reason) params.set("reason", reason);
    if (productId) params.set("productId", productId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [reason, productId, from, to]);

  async function loadProducts() {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Cannot load products");
    }
    setProducts(data.map((item: Product) => ({ id: item.id, name: item.name, sku: item.sku })));
  }

  async function loadLogs() {
    const response = await fetch(`/api/inventory-logs?${query}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Cannot load inventory logs");
    }
    setLogs(data);
  }

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([loadProducts(), loadLogs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load inventory data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtime((event) => {
    if (event.type === "stock.updated" || event.type === "order.created" || event.type === "order.updated") {
      void loadLogs();
    }
    if (event.type === "product.updated") {
      void loadProducts();
    }
  });

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load inventory logs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="card">
        <form onSubmit={onFilter}>
          <div className="grid grid-3 items-end gap-3">
            <div className="field">
              <label htmlFor="reason">ประเภท</label>
              <select id="reason" value={reason} onChange={(event) => setReason(event.target.value)}>
                <option value="">ทั้งหมด</option>
                <option value="SALE">ขาย</option>
                <option value="ADJUST">ปรับ</option>
                <option value="RESTOCK">เติมสต็อก</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="product">สินค้า</label>
              <select id="product" value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">ทั้งหมด</option>
                {products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="from">ตั้งแต่</label>
              <input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="to">ถึง</label>
              <input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>

            <button type="submit" disabled={loading}>
              ค้นหา
            </button>

            <button type="button" className="secondary" onClick={() => void refresh()} disabled={loading}>
              รีเฟรช
            </button>
            <a className="secondary" href={`/api/inventory-logs/export?${query}`} target="_blank" rel="noreferrer">
              export csv
            </a>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">ประวัติสต็อก</h2>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-[var(--muted)]">กำลังโหลด...</p> : null}

        {!loading ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>สินค้า</th>
                  <th>ประเภท</th>
                  <th>จำนวน</th>
                  <th>Order</th>
                  <th>ผู้ทำรายการ</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{productMap.get(log.productId)?.name || log.product.name}</td>
                    <td>{reasonLabel[log.reason]}</td>
                    <td className={`font-semibold ${log.deltaQty < 0 ? "text-red-600" : "text-[var(--ok)]"}`}>
                      {log.deltaQty > 0 ? `+${log.deltaQty}` : log.deltaQty}
                    </td>
                    <td>{log.order?.orderNumber || "-"}</td>
                    <td>{log.actor || "-"}</td>
                    <td>{log.note || "-"}</td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-[var(--muted)]">
                      ไม่พบรายการ
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
